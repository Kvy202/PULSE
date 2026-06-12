import { Router } from 'express';
import { Round } from '../models/Round.js';
import { WorldState } from '../models/WorldState.js';
import { Soul } from '../models/Soul.js';
import { classifySoul, minorityRateOf, REVEAL_AT } from '../game/alignment.js';
import { getMetrics } from '../game/loop.js';

// Read-only endpoints — handy for debugging and the later meta-timeline phase.
export const statsRouter = Router();

// Aggregate analytics for the running experiment: live counters from the loop
// plus rollups from the database (who the crowd is, how the war stands).
statsRouter.get('/metrics', async (_req, res) => {
  const [world, totalSouls, roundsResolved, byAlignment] = await Promise.all([
    WorldState.findById('global').lean(),
    Soul.countDocuments(),
    Round.countDocuments({ status: 'resolved', result: { $ne: null } }),
    Soul.aggregate([
      { $match: { alignment: { $ne: null } } },
      { $group: { _id: '$alignment', count: { $sum: 1 } } },
    ]),
  ]);

  const alignmentDistribution = Object.fromEntries(byAlignment.map((a) => [a._id, a.count]));

  res.json({
    ...getMetrics(),
    roundsResolved,
    totalSouls,
    alignmentDistribution,
    factionStandings: world?.factions ?? {},
    survival: world?.survival ?? null,
    era: world?.era ?? null,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

statsRouter.get('/world', async (_req, res) => {
  const world = await WorldState.findById('global').lean();
  res.json(world ?? null);
});

// A soul's emerging character — the data behind the Phase 4 "it's been watching
// ME" reveal. Once a soul has cast REVEAL_AT votes it gets an alignment, plus a
// real rarity figure (what share of profiled souls share that alignment).
statsRouter.get('/soul/:sessionId', async (req, res) => {
  const soul = await Soul.findOne({ sessionId: req.params.sessionId }).lean();
  if (!soul) return res.json(null);

  const alignment = classifySoul(soul);

  // Rarity: classify every soul with enough history and see how many match.
  // Fine at prototype scale; at true scale store `alignment` and aggregate.
  let rarity = null;
  if (alignment) {
    const peers = await Soul.find({ votesCast: { $gte: REVEAL_AT } })
      .select('votesCast minorityCount')
      .lean();
    const same = peers.filter((p) => classifySoul(p) === alignment).length;
    rarity = peers.length ? same / peers.length : 1;
  }

  res.json({
    sessionId: soul.sessionId,
    votesCast: soul.votesCast,
    minorityCount: soul.minorityCount,
    minorityRate: minorityRateOf(soul),
    alignment,
    rarity,
    revealAt: REVEAL_AT,
    firstSeen: soul.firstSeen,
  });
});

// The meta-reveal payload (Layer 5): the collective's measurable character plus
// the branching decision-history of humanity. Returns the most recent rounds in
// chronological order so the client can draw the timeline top-to-bottom.
statsRouter.get('/timeline', async (_req, res) => {
  const world = await WorldState.findById('global').lean();
  const recent = await Round.find({ status: 'resolved', result: { $ne: null } })
    .sort({ roundNumber: -1 })
    .limit(120)
    .select('roundNumber dilemma result tally')
    .lean();
  res.json({
    personality: world?.personality ?? null,
    era: world?.era ?? null,
    survival: world?.survival ?? null,
    rounds: recent.reverse(),
  });
});

statsRouter.get('/history', async (_req, res) => {
  const rounds = await Round.find({ status: 'resolved', result: { $ne: null } })
    .sort({ roundNumber: -1 })
    .limit(50)
    .select('roundNumber dilemma result tally consequence startedAt')
    .lean();
  res.json(rounds);
});
