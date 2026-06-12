import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalityShift, eraFor } from '../personality.js';

test('personalityShift returns empty for unknown theme', () => {
  assert.deepEqual(personalityShift('nonsense', 'A', 1), {});
});

test('personalityShift scales with margin', () => {
  const flip = personalityShift('trust', 'A', 0); // coin-flip
  const land = personalityShift('trust', 'A', 1); // landslide
  assert.ok(land.trust > flip.trust, 'landslide should shift trust more than a coin-flip');
  assert.ok(flip.trust > 0, 'even a coin-flip nudges character');
});

test('personalityShift: a comforting lie erodes trust', () => {
  const shift = personalityShift('trust', 'B', 1);
  assert.ok(shift.trust < 0, 'lying should reduce trust');
});

test('eraFor ages through the named eras', () => {
  assert.equal(eraFor(0), 'Dawn');
  assert.equal(eraFor(9), 'Dawn');
  assert.equal(eraFor(10), 'Stirring');
  assert.equal(eraFor(59), 'Tempest');
  assert.equal(eraFor(100), 'Ascendance');
  assert.equal(eraFor(99999), 'Ascendance');
});
