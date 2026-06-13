import { config } from '../config.js';

// Ambient bots so the experiment is never a dead room. They vote among
// themselves when no humans are around and blend in when humans arrive — and
// because they cast through the same castVote path as real souls, they populate
// the World-Brain, the factions, the alignment distribution, and the rarity
// figures automatically. The number of bots "awake" breathes randomly each round.
//
// Archetypes map naturally onto the alignment classifier (which keys off how
// often a soul lands in the minority), so the crowd self-sorts into real tribes:
//   herd/guardian → follow the leader  → end up Guardian
//   contrarian/martyr → back the underdog → end up Contrarian / Martyr
//   gambler → coin-flip → end up Gambler

const ARCHETYPES = ['herd', 'guardian', 'contrarian', 'gambler', 'martyr'];

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let pool = [];
let timers = [];
let present = 0;

export function initBots() {
  pool = [];
  for (let i = 0; i < config.botPoolSize; i++) {
    pool.push({
      id: `bot:${i}`,
      archetype: ARCHETYPES[i % ARCHETYPES.length],
      biasA: 0.35 + Math.random() * 0.3, // mild personal lean when there's no signal yet
    });
  }
  present = randInt(config.botPresenceMin, config.botPresenceMax);
}

// Pure: how a bot votes given its archetype and the tally so far. Early in a
// round (little signal) it leans on its personal bias; once a leader emerges,
// followers pile on and contrarians push back — producing an organic tug-of-war.
export function botChoice(bot, tally) {
  const total = (tally?.A ?? 0) + (tally?.B ?? 0);
  const leaderA = (tally?.A ?? 0) >= (tally?.B ?? 0);
  const byBias = () => (Math.random() < bot.biasA ? 'A' : 'B');
  if (total < 2) return byBias();
  switch (bot.archetype) {
    case 'herd':
    case 'guardian':
      return Math.random() < 0.85 ? (leaderA ? 'A' : 'B') : byBias();
    case 'contrarian':
    case 'martyr':
      return Math.random() < 0.85 ? (leaderA ? 'B' : 'A') : byBias();
    case 'gambler':
    default:
      return Math.random() < 0.5 ? 'A' : 'B';
  }
}

// Random-walk the count of "awake" bots so presence breathes instead of jumping.
function stepPresence() {
  present = clamp(present + randInt(-config.botChurn, config.botChurn), config.botPresenceMin, config.botPresenceMax);
  return present;
}

export function presentCount() {
  return config.botsEnabled ? present : 0;
}

function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Schedule this round's bot votes, staggered across the voting window so the
// tally moves gradually (and the brain fires synapses over time). Returns the
// number of bots awake this round, for the presence counter.
export function scheduleRound({ voteMs, getTally, castVote }) {
  cancelRound();
  if (!config.botsEnabled) return 0;
  const n = stepPresence();
  const awake = sample(pool, Math.min(n, pool.length));
  const window = Math.max(800, voteMs - 1200);
  for (const bot of awake) {
    if (Math.random() > config.botVoteProb) continue; // not everyone votes every round
    const delay = randInt(400, window);
    timers.push(
      setTimeout(() => {
        try {
          castVote(bot.id, botChoice(bot, getTally()));
        } catch {
          /* a bot vote failing is never fatal */
        }
      }, delay)
    );
  }
  return n;
}

export function cancelRound() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
