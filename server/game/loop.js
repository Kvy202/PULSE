import { Round } from '../models/Round.js';
import { Vote } from '../models/Vote.js';
import { WorldState } from '../models/WorldState.js';
import { Soul } from '../models/Soul.js';
import { generateDilemma } from './dilemmaGen.js';
import { config } from '../config.js';
import {
  classifySoul,
  minorityRateOf,
  FACTIONS,
  ALL_FACTIONS,
  emptyFactionTally,
} from './alignment.js';
import { personalityShift, eraFor } from './personality.js';
import { applyConsequence } from './consequences.js';
import { TUNING } from './tuning.js';

// The heartbeat. A single in-process loop is the authoritative clock: it owns
// the active round, the live tally, and when the verdict falls. Clients only
// render what this broadcasts.
//
// The live tally is kept in memory for fast broadcast AND persisted to Mongo
// ($inc) so a restart resumes the round number and world state.

let io = null;

const MAX_FACTION_CACHE = 50_000; // bound the in-memory tug-of-war roster

const state = {
  round: null, // the active Mongo Round document
  tally: { A: 0, B: 0 }, // in-memory live counts
  votedSessions: new Set(), // dedupe within the current round
  timer: null, // pending setTimeout for the next phase transition
  factionTally: emptyFactionTally(), // how each tribe is splitting THIS round
  factionOf: new Map(), // sessionId -> faction (the live tug-of-war roster)
  pending: { A: 0, B: 0 }, // votes accrued since the last broadcast flush
  flushTimer: null, // pending coalesced-broadcast flush
  phase: 'voting', // 'voting' | 'reveal'
  lastReveal: null, // the last round:resolve payload (for mid-reveal late joiners)
  votesByIp: new Map(), // per-IP vote count THIS round (anti-ballot-stuffing)
  mutedUntil: new Map(), // sessionId -> round number through which it's silenced
  metrics: { votesAllTime: 0, roundsAllTime: 0, mutesAllTime: 0 }, // since boot
};

// Cache a soul's faction, evicting the oldest entry if the roster grows too
// large, so a long-lived server never leaks memory on unique sessions.
function rememberFaction(sessionId, faction) {
  if (state.factionOf.size >= MAX_FACTION_CACHE && !state.factionOf.has(sessionId)) {
    state.factionOf.delete(state.factionOf.keys().next().value);
  }
  state.factionOf.set(sessionId, faction);
}

// Keep the heartbeat alive even if a phase throws (e.g. a transient DB blip):
// any failure logs and reschedules a fresh round rather than freezing forever.
function scheduleNextPhase(fn, ms) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    fn().catch((err) => {
      console.error('[loop] phase failed — recovering heartbeat in 2s', err);
      scheduleNextPhase(startRound, 2000);
    });
  }, ms);
}

// Coalesce live vote broadcasts: a vote marks pending deltas and ensures a flush
// is scheduled, so N votes in a tick become one message carrying the new totals
// plus how many landed on each side (dA/dB) for the World-Brain's synapses.
function markVote(choice) {
  state.pending[choice] += 1;
  if (!state.flushTimer) {
    state.flushTimer = setTimeout(flushBroadcast, config.broadcastMs);
  }
}

function flushBroadcast() {
  state.flushTimer = null;
  const { A: dA, B: dB } = state.pending;
  if (dA === 0 && dB === 0) return;
  state.pending = { A: 0, B: 0 };
  io?.emit('tally:update', { A: state.tally.A, B: state.tally.B, dA, dB });
  io?.emit('faction:update', getFactionPayload());
}

function resetBroadcast() {
  clearTimeout(state.flushTimer);
  state.flushTimer = null;
  state.pending = { A: 0, B: 0 };
}

export function getActiveRoundPayload() {
  if (!state.round) return null;
  return {
    roundNumber: state.round.roundNumber,
    dilemma: state.round.dilemma,
    endsAt: state.round.endsAt.getTime(),
    tally: { ...state.tally },
  };
}

export function getFactionPayload() {
  return { factions: state.factionTally };
}

// During the verdict reveal there is no live round, so late joiners get the
// last verdict (with its dilemma context) instead of an expired countdown.
export function getRevealPayload() {
  return state.phase === 'reveal' ? state.lastReveal : null;
}

// Snapshot of in-memory counters for the metrics endpoint.
export function getMetrics() {
  return {
    ...state.metrics,
    currentRound: state.round?.roundNumber ?? 0,
    votesThisRound: state.tally.A + state.tally.B,
    mutedSouls: state.mutedUntil.size,
  };
}

// The power/mute consequence: silence a real, randomly-chosen connected soul for
// the next `muteRounds`. They get a 'muted' event and their vote is rejected.
function muteRandomSoul() {
  if (!io) return;
  const sockets = [...io.sockets.sockets.values()];
  if (!sockets.length) return;
  const victim = sockets[Math.floor(Math.random() * sockets.length)];
  const sessionId = victim.data?.sessionId;
  if (!sessionId) return;
  const untilRound = (state.round?.roundNumber ?? 0) + config.muteRounds;
  state.mutedUntil.set(sessionId, untilRound);
  state.metrics.mutesAllTime += 1;
  victim.emit('muted', { untilRound, rounds: config.muteRounds });
  console.log(`[loop] muted a soul through round ${untilRound}`);
}

// Handshake when a soul connects: load (or create) its record, cache its faction
// for the live tug-of-war, and hand back its profile so the badge shows at once.
export async function helloSoul(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 100) return null;
  let soul = await Soul.findOne({ sessionId }).lean();
  if (!soul) {
    try {
      soul = (await Soul.create({ sessionId })).toObject();
    } catch (err) {
      // Two rapid hellos for a new soul can race on the unique sessionId index.
      if (err?.code === 11000) soul = await Soul.findOne({ sessionId }).lean();
      else throw err;
    }
  }
  const alignment = classifySoul(soul);
  rememberFaction(sessionId, alignment ?? 'Unaligned');

  // The "you weren't here" twist: if this returning soul has missed resolved
  // rounds since it was last seen, hand it the verdict strangers decided in its
  // absence. Only for souls with prior history (not first-timers).
  const currentRound = state.round?.roundNumber ?? 0;
  let missed = null;
  if (soul.lastSeenRound > 0 && currentRound - soul.lastSeenRound > 1 && state.lastReveal) {
    missed = {
      roundNumber: state.lastReveal.roundNumber,
      result: state.lastReveal.result,
      label: state.lastReveal.consequence?.label ?? 'The world changed.',
      sinceRound: soul.lastSeenRound,
    };
  }
  if (currentRound) {
    await Soul.updateOne({ sessionId }, { $set: { lastSeenRound: currentRound } });
  }

  return {
    sessionId,
    votesCast: soul.votesCast,
    minorityRate: minorityRateOf(soul),
    streak: soul.streak,
    alignment,
    missed,
  };
}

export async function getWorldState() {
  return WorldState.findById('global').lean();
}

export function init(socketServer) {
  io = socketServer;
}

// Seed the singleton world, then begin the eternal loop.
export async function bootstrap() {
  await WorldState.findByIdAndUpdate(
    'global',
    { $setOnInsert: { survival: 100, era: 'Dawn' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Abandon any round left 'active' by a previous process (it has no result and
  // is excluded from history) so we never run two active rounds at once.
  await Round.updateMany({ status: 'active' }, { $set: { status: 'resolved' } });
  // One-time trim of any pre-existing oversized history buffer.
  await WorldState.updateOne(
    { _id: 'global' },
    { $push: { history: { $each: [], $slice: -TUNING.historyBuffer } } }
  );
  // Backfill the Layer-4 fields for a world that predates them.
  await WorldState.updateOne(
    { _id: 'global', palette: { $exists: false } },
    { $set: { palette: { red: true, green: true, blue: true }, ageBase: 0, lastMessage: null } }
  );
  await startRound();
}

async function startRound() {
  const last = await Round.findOne().sort({ roundNumber: -1 }).select('roundNumber').lean();
  const roundNumber = (last?.roundNumber ?? 0) + 1;

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + config.voteMs);

  // The dilemma is composed live from the collective's current character.
  const world = await WorldState.findById('global').lean();
  const dilemma = generateDilemma(world);
  // The per-option consequence specs are stored on the round but kept OUT of the
  // client payload (getActiveRoundPayload) so the exact effect stays a surprise.
  const { consequence: consequenceSpec, ...dilemmaForClient } = dilemma;

  state.round = await Round.create({
    roundNumber,
    dilemma: dilemmaForClient,
    consequenceSpec,
    startedAt,
    endsAt,
    status: 'active',
    tally: { A: 0, B: 0 },
  });
  state.tally = { A: 0, B: 0 };
  state.votedSessions = new Set();
  state.factionTally = emptyFactionTally();
  state.votesByIp = new Map();
  state.phase = 'voting';
  state.metrics.roundsAllTime += 1;
  // Prune mutes whose term has passed so the map can't grow unbounded.
  for (const [sid, until] of state.mutedUntil) {
    if (until < roundNumber) state.mutedUntil.delete(sid);
  }
  resetBroadcast();

  console.log(`[loop] round ${roundNumber} started — "${state.round.dilemma.prompt}"`);

  io?.emit('round:start', getActiveRoundPayload());
  io?.emit('faction:update', getFactionPayload());

  scheduleNextPhase(resolveRound, config.voteMs);
}

// Record one soul's vote. Rejects silently if the round is closed, the choice
// is invalid, the session already voted, or the IP is over its per-round cap.
export async function castVote(sessionId, choice, ip) {
  if (!state.round || state.round.status !== 'active') return;
  if (choice !== 'A' && choice !== 'B') return;
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 100) return;
  if (state.votedSessions.has(sessionId)) return;
  // Silenced souls (the mute consequence) cannot vote until their term ends.
  if ((state.mutedUntil.get(sessionId) ?? 0) >= state.round.roundNumber) return;
  // Anti-ballot-stuffing: cap distinct sessions voting from one IP per round.
  if (ip && (state.votesByIp.get(ip) || 0) >= config.maxVotesPerIpPerRound) return;

  state.votedSessions.add(sessionId);
  if (ip) state.votesByIp.set(ip, (state.votesByIp.get(ip) || 0) + 1);
  state.tally[choice] += 1;

  try {
    await Vote.create({ roundId: state.round._id, sessionId, choice });
    await Round.updateOne({ _id: state.round._id }, { $inc: { [`tally.${choice}`]: 1 } });
  } catch (err) {
    // Duplicate-key (unique roundId+sessionId) means a race; roll back memory.
    if (err?.code === 11000) {
      state.tally[choice] -= 1;
      return;
    }
    throw err;
  }

  state.metrics.votesAllTime += 1;

  // Tally this vote under the soul's tribe for the live tug-of-war. Souls not
  // yet profiled fight as 'Unaligned'.
  let faction = state.factionOf.get(sessionId) || 'Unaligned';
  if (!ALL_FACTIONS.includes(faction)) faction = 'Unaligned';
  state.factionTally[faction][choice] += 1;

  // Queue a coalesced broadcast rather than emitting on every single vote.
  markVote(choice);
}

async function resolveRound() {
  if (!state.round) return;

  const { A, B } = state.tally;
  const result = A >= B ? 'A' : 'B'; // ties resolve to A (documented)
  const total = A + B;
  const marginFraction = total ? Math.abs(A - B) / total : 0;

  // The bespoke, binding consequence: read the world first (so the outcome can
  // reference it), then turn the winning option's spec into a dramatic record
  // plus the world mutations it implies.
  const worldBefore = await WorldState.findById('global').lean();
  const spec = state.round.consequenceSpec?.[result];
  const outcome = applyConsequence(spec, {
    result,
    marginFraction,
    world: worldBefore,
    roundNumber: state.round.roundNumber,
  });

  state.round.status = 'resolved';
  state.round.result = result;
  state.round.consequence = outcome.record;
  await state.round.save();

  // $inc: the consequence's survival change, faction wins, and personality drift.
  const incs = { ...(outcome.inc || {}) };
  for (const f of FACTIONS) {
    const ft = state.factionTally[f];
    if (!ft || ft.A + ft.B === 0) continue;
    const tribeChoice = ft.A >= ft.B ? 'A' : 'B';
    if (tribeChoice === result) incs[`factions.${f}.wins`] = (incs[`factions.${f}.wins`] || 0) + 1;
  }
  const pShift = personalityShift(state.round.dilemma.theme, result, marginFraction);
  for (const [trait, v] of Object.entries(pShift)) {
    incs[`personality.${trait}`] = (incs[`personality.${trait}`] || 0) + v;
  }

  // $push: bounded history buffer + any newly-unlocked relic (deduped by name).
  const pushOps = {
    history: {
      $each: [{ roundNumber: state.round.roundNumber, result, ts: new Date() }],
      $slice: -TUNING.historyBuffer,
    },
  };
  const relic = outcome.push?.artifacts;
  if (relic && !(worldBefore.artifacts || []).some((a) => a.name === relic.name)) {
    pushOps.artifacts = relic;
  }

  const incUpdate = { $push: pushOps };
  if (Object.keys(incs).length) incUpdate.$inc = incs;
  let world = await WorldState.findByIdAndUpdate('global', incUpdate, { new: true }).lean();

  // Clamp meters and age the world; then let the consequence's own $set win for
  // any keys it owns (a reset overrides survival/personality/palette directly).
  const clampSets = {};
  const survivalC = Math.max(0, Math.min(100, world.survival));
  if (survivalC !== world.survival) clampSets.survival = survivalC;
  for (const trait of ['trust', 'chaos', 'mercy']) {
    const raw = world.personality?.[trait] ?? 50;
    const fixed = Math.max(0, Math.min(100, Math.round(raw)));
    if (fixed !== raw) clampSets[`personality.${trait}`] = fixed;
  }
  const ageBase = outcome.set?.ageBase ?? world.ageBase ?? 0;
  const era = eraFor(state.round.roundNumber - ageBase);
  if (era !== world.era) clampSets.era = era;

  const sets = { ...clampSets, ...(outcome.set || {}) };
  if (Object.keys(sets).length) {
    world = await WorldState.findByIdAndUpdate('global', { $set: sets }, { new: true }).lean();
  }

  // Phase 4 groundwork: profile every soul from this round's outcome, so the
  // alignment reveal has real history to draw on later. Each soul's vote either
  // matched the winning result or landed in the minority.
  try {
    const votes = await Vote.find({ roundId: state.round._id }).select('sessionId choice').lean();
    if (votes.length) {
      await Soul.bulkWrite(
        votes.map((v) => ({
          updateOne: {
            filter: { sessionId: v.sessionId },
            update: {
              $inc: { votesCast: 1, minorityCount: v.choice === result ? 0 : 1 },
              $setOnInsert: { firstSeen: new Date() },
            },
            upsert: true,
          },
        }))
      );

      // Recompute each voter's alignment from their updated record, persist it,
      // and refresh the live faction roster so their tribe is right next round.
      const sids = [...new Set(votes.map((v) => v.sessionId))];
      const profiled = await Soul.find({ sessionId: { $in: sids } })
        .select('sessionId votesCast minorityCount streak lastVotedRound')
        .lean();
      const roundNumber = state.round.roundNumber;
      const alignOps = [];
      for (const p of profiled) {
        const a = classifySoul(p);
        rememberFaction(p.sessionId, a ?? 'Unaligned');
        // Streak = consecutive rounds voted in (resets if they skipped a round).
        const streak = p.lastVotedRound === roundNumber - 1 ? (p.streak || 0) + 1 : 1;
        alignOps.push({
          updateOne: {
            filter: { sessionId: p.sessionId },
            update: { $set: { alignment: a, streak, lastVotedRound: roundNumber } },
          },
        });
      }
      if (alignOps.length) await Soul.bulkWrite(alignOps);
    }
  } catch (err) {
    console.error('[loop] soul profiling failed', err);
  }

  console.log(`[loop] round ${state.round.roundNumber} resolved — ${result} (A:${A} B:${B})`);

  const revealPayload = {
    result,
    tally: { A, B },
    consequence: outcome.record,
    roundNumber: state.round.roundNumber,
  };
  // Enter the reveal phase and remember this verdict (with dilemma context) so
  // souls that join mid-reveal can render it instead of a dead countdown.
  state.phase = 'reveal';
  state.lastReveal = {
    ...revealPayload,
    dilemma: state.round.dilemma,
    endsAt: state.round.endsAt.getTime(),
  };

  io?.emit('round:resolve', revealPayload);
  io?.emit('world:update', { worldState: world });

  // A mute verdict silences a real, randomly-chosen connected soul.
  if (outcome.record.type === 'mute') muteRandomSoul();

  scheduleNextPhase(startRound, config.revealMs);
}
