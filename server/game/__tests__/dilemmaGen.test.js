import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDilemma, approxVariety } from '../dilemmaGen.js';

const VALID = new Set(['survival', 'tint', 'message', 'artifact', 'reset', 'mute']);

test('every generated dilemma is complete with valid consequences on both sides', () => {
  for (let i = 0; i < 2000; i++) {
    const world = {
      survival: 50,
      era: 'Tempest',
      personality: { trust: (i * 7) % 100, chaos: (i * 13) % 100, mercy: (i * 17) % 100 },
    };
    const d = generateDilemma(world);
    assert.ok(d.prompt && d.optionA && d.optionB, 'has prompt + options');
    assert.ok(d.theme, 'has a theme');
    assert.ok(VALID.has(d.consequence?.A?.type), `A consequence valid (${d.consequence?.A?.type})`);
    assert.ok(VALID.has(d.consequence?.B?.type), `B consequence valid (${d.consequence?.B?.type})`);
  }
});

test('the engine produces broad variety (combinatorial, not a short loop)', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const d = generateDilemma({ personality: { trust: 50, chaos: 50, mercy: 50 } });
    seen.add(`${d.prompt}|${d.optionA}|${d.optionB}`);
  }
  // Far more than a hand-written list; thousands of distinct dilemmas.
  assert.ok(seen.size > 1800, `expected >1800 distinct dilemmas, got ${seen.size}`);
});

test('approxVariety reports a large distinct-dilemma ceiling', () => {
  assert.ok(approxVariety() > 20000, `expected >20k theoretical variety, got ${approxVariety()}`);
});

test('truth messages embed live state; lies are canned', () => {
  let sawTruth = false;
  let sawLie = false;
  for (let i = 0; i < 600 && !(sawTruth && sawLie); i++) {
    const d = generateDilemma({ survival: 42, personality: { trust: 0 } });
    for (const side of ['A', 'B']) {
      const c = d.consequence[side];
      if (c?.type === 'message' && c.kind === 'truth' && c.text?.includes('42')) sawTruth = true;
      if (c?.type === 'message' && c.kind === 'lie' && c.text) sawLie = true;
    }
  }
  assert.ok(sawTruth, 'expected a truth message embedding survival 42');
  assert.ok(sawLie, 'expected a canned lie message');
});
