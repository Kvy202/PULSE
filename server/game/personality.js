// The emergent character of the collective. Every resolved round nudges three
// traits — trust, chaos, mercy — according to what the crowd chose and how
// lopsided the choice was. Over hundreds of rounds these drift into a real,
// measurable personality: the 2050 payoff of Layer 5.
//
// Each theme maps its winning option to a set of trait deltas. The magnitude
// scales with how decisive the vote was (a landslide shapes character harder
// than a coin-flip) and a master dial in game/tuning.js. Effect deltas below
// are the per-theme shape; the speed of drift is tuned centrally.

import { TUNING } from './tuning.js';

const EFFECTS = {
  // Meteor: DEFLECT/save the city (A) vs SHIELD/save the people (B).
  survival: { A: { chaos: 3, mercy: -2 }, B: { mercy: 3, trust: 1 } },
  // Delete a color forever — disruptive whichever way it falls.
  identity: { A: { chaos: 2 }, B: { chaos: 2 } },
  // Tell the truth (A) vs a comforting lie (B).
  trust: { A: { trust: 3 }, B: { trust: -3, mercy: 1 } },
  // Reset to Day One (A) vs let the world keep aging (B).
  time: { A: { chaos: 3, trust: -1 }, B: { trust: 2, chaos: -1 } },
  // Spare the stranger (A) vs mute them (B).
  power: { A: { mercy: 3 }, B: { mercy: -3, chaos: 2 } },
};

export function personalityShift(theme, result, marginFraction) {
  const base = EFFECTS[theme]?.[result];
  if (!base) return {};
  const { magnitude, scaleMin, scaleRange } = TUNING.personality;
  const scale = (scaleMin + marginFraction * scaleRange) * magnitude;
  const out = {};
  for (const [trait, v] of Object.entries(base)) out[trait] = v * scale;
  return out;
}

// The world ages through named eras as the rounds accumulate.
export function eraFor(roundNumber) {
  for (const { until, name } of TUNING.eras) {
    if (roundNumber < until) return name;
  }
  return TUNING.eras[TUNING.eras.length - 1].name;
}
