// Alignment classification — the engine of Phase 4's "it's been watching ME"
// reveal. A soul's record is profiled on every resolved round (see resolveRound
// in loop.js); this turns that record into a character.
//
// All cutoffs live in game/tuning.js so they can be calibrated in one place.

import { TUNING } from './tuning.js';

export const REVEAL_AT = TUNING.revealAt;

// The tribes that wage the live tug-of-war (Layer 3). Souls without enough
// history to be classified fight under the 'Unaligned' banner, which competes
// in the live tally but does not score in the all-time war standings.
export const FACTIONS = ['Guardian', 'Gambler', 'Contrarian', 'Martyr'];
export const ALL_FACTIONS = [...FACTIONS, 'Unaligned'];

export function emptyFactionTally() {
  const t = {};
  for (const f of ALL_FACTIONS) t[f] = { A: 0, B: 0 };
  return t;
}

export function minorityRateOf(soul) {
  if (!soul || !soul.votesCast) return 0;
  return soul.minorityCount / soul.votesCast;
}

export function classifySoul(soul) {
  const votes = soul?.votesCast ?? 0;
  if (votes < REVEAL_AT) return null; // not enough data to reveal a character yet

  const { contrarian, gambler, guardian } = TUNING.alignment;
  const rate = minorityRateOf(soul);
  if (rate >= contrarian) return 'Contrarian'; // rides hard against the crowd
  if (rate >= gambler) return 'Gambler'; // flips a coin with fate
  if (rate <= guardian) return 'Guardian'; // moves with the protective majority
  return 'Martyr'; // often on the losing side, but not by rule
}
