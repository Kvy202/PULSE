import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDilemma } from '../dilemmaGen.js';

test('generateDilemma always returns a complete dilemma with consequences', () => {
  // Run many times across varied personalities to exercise every theme/template.
  for (let i = 0; i < 200; i++) {
    const world = {
      survival: 50,
      era: 'Tempest',
      personality: { trust: (i * 7) % 100, chaos: (i * 13) % 100, mercy: (i * 17) % 100 },
    };
    const d = generateDilemma(world);
    assert.ok(d.prompt && d.optionA && d.optionB, 'has prompt + options');
    assert.ok(d.theme, 'has a theme');
    assert.ok(d.consequence?.A?.type && d.consequence?.B?.type, 'both options carry a consequence spec');
  }
});

test('world-state templates weave in live values', () => {
  // The survival reactor template injects the live survival number.
  let sawInjected = false;
  for (let i = 0; i < 400 && !sawInjected; i++) {
    const d = generateDilemma({ survival: 42, era: 'Dawn', personality: { mercy: 100 } });
    if (d.prompt.includes('42')) sawInjected = true;
  }
  assert.ok(sawInjected, 'expected a survival-injected prompt within many draws');
});
