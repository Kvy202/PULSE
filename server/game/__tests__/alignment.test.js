import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySoul,
  minorityRateOf,
  emptyFactionTally,
  ALL_FACTIONS,
  REVEAL_AT,
} from '../alignment.js';

test('classifySoul returns null below the reveal threshold', () => {
  assert.equal(classifySoul({ votesCast: REVEAL_AT - 1, minorityCount: 5 }), null);
});

test('classifySoul: never-minority soul is a Guardian', () => {
  assert.equal(classifySoul({ votesCast: 10, minorityCount: 0 }), 'Guardian');
});

test('classifySoul: always-minority soul is a Contrarian', () => {
  assert.equal(classifySoul({ votesCast: 10, minorityCount: 10 }), 'Contrarian');
});

test('classifySoul: coin-flip soul is a Gambler', () => {
  assert.equal(classifySoul({ votesCast: 10, minorityCount: 5 }), 'Gambler');
});

test('classifySoul: occasionally-losing soul is a Martyr', () => {
  assert.equal(classifySoul({ votesCast: 10, minorityCount: 3 }), 'Martyr');
});

test('minorityRateOf handles zero votes', () => {
  assert.equal(minorityRateOf({ votesCast: 0, minorityCount: 0 }), 0);
  assert.equal(minorityRateOf({ votesCast: 4, minorityCount: 1 }), 0.25);
});

test('emptyFactionTally has every faction zeroed', () => {
  const t = emptyFactionTally();
  for (const f of ALL_FACTIONS) assert.deepEqual(t[f], { A: 0, B: 0 });
});
