import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botChoice } from '../bots.js';

const trials = (bot, tally, n = 2000) => {
  let a = 0;
  for (let i = 0; i < n; i++) if (botChoice(bot, tally) === 'A') a += 1;
  return a / n;
};

test('every bot choice is a valid option', () => {
  for (const archetype of ['herd', 'guardian', 'contrarian', 'gambler', 'martyr']) {
    const c = botChoice({ archetype, biasA: 0.5 }, { A: 3, B: 1 });
    assert.ok(c === 'A' || c === 'B');
  }
});

test('herd/guardian follow the leader most of the time', () => {
  assert.ok(trials({ archetype: 'herd', biasA: 0.5 }, { A: 10, B: 0 }) > 0.7);
  assert.ok(trials({ archetype: 'guardian', biasA: 0.5 }, { A: 0, B: 10 }) < 0.3);
});

test('contrarian/martyr back the underdog most of the time', () => {
  assert.ok(trials({ archetype: 'contrarian', biasA: 0.5 }, { A: 10, B: 0 }) < 0.3);
  assert.ok(trials({ archetype: 'martyr', biasA: 0.5 }, { A: 0, B: 10 }) > 0.7);
});

test('gambler is roughly a coin flip', () => {
  const rate = trials({ archetype: 'gambler', biasA: 0.5 }, { A: 10, B: 0 });
  assert.ok(rate > 0.4 && rate < 0.6);
});

test('with no signal yet, a bot leans on its personal bias', () => {
  const rate = trials({ archetype: 'herd', biasA: 0.9 }, { A: 0, B: 0 });
  assert.ok(rate > 0.8 && rate < 1.0, `expected ~0.9, got ${rate}`);
});
