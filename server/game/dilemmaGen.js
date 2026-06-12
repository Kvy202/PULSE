// Living dilemmas (Phase 5). Each round's choice is composed from the crowd's
// current character — its personality, era, and survival — so the experiment
// "writes itself" as the collective evolves. No external model is required.
//
// ── LLM seam ───────────────────────────────────────────────────────────────
// To later let a language model author dilemmas, add an async generator here
// gated on an API key, e.g.:
//
//   if (process.env.LLM_API_KEY) return await llmDilemma(world);
//
// passing the world state into the prompt. Until a key exists, the procedural
// generator below is the default and the only code path — nothing calls out to
// an external service.
// ─────────────────────────────────────────────────────────────────────────────

import { pickDilemma } from './dilemmas.js';

// Template pools per theme. An entry is either a static dilemma body or a
// function (world) => body, letting some prompts weave in the live world state.
// Every body carries a `consequence: { A, B }` spec — what each option does to
// the world if it wins (see game/consequences.js for the spec shapes).
const TEMPLATES = {
  survival: [
    {
      prompt: 'A meteor approaches. Spend the world’s last energy to —',
      optionA: 'DEFLECT it (save the city)',
      optionB: 'SHIELD the survivors (save the people)',
      consequence: {
        A: { type: 'survival', amount: 4, label: 'The city stands. Survival holds.' },
        B: { type: 'survival', amount: 3, label: 'The survivors endure.' },
      },
    },
    {
      prompt: 'A plague spreads. The last serum can cure —',
      optionA: 'the many strangers',
      optionB: 'the chosen few',
      consequence: {
        A: { type: 'survival', amount: 3, label: 'The many are cured.' },
        B: { type: 'survival', amount: 2, label: 'The chosen few are saved.' },
      },
    },
    (w) => ({
      prompt: `Survival reads ${w.survival ?? 100}. The reactor is failing — do you —`,
      optionA: 'vent the core (save the station)',
      optionB: 'seal the wing (save those trapped inside)',
      consequence: {
        A: { type: 'survival', amount: 4, label: 'The station is saved.' },
        B: { type: 'survival', amount: 2, label: 'Those trapped are spared.' },
      },
    }),
  ],
  identity: [
    {
      prompt: 'The world can keep ONE color. Forever delete —',
      optionA: 'Blue',
      optionB: 'Red',
      consequence: {
        A: { type: 'tint', remove: 'blue' },
        B: { type: 'tint', remove: 'red' },
      },
    },
    {
      prompt: 'Two tongues remain. Silence —',
      optionA: 'the old language',
      optionB: 'the new language',
      consequence: {
        A: { type: 'artifact', name: 'The Old Tongue, Silenced', icon: '☓' },
        B: { type: 'artifact', name: 'The New Tongue, Silenced', icon: '✶' },
      },
    },
    {
      prompt: 'The collective must wear one face. Erase —',
      optionA: 'who it was',
      optionB: 'who it could become',
      consequence: {
        A: { type: 'artifact', name: 'The Forgotten Past', icon: '☽' },
        B: { type: 'artifact', name: 'The Severed Future', icon: '☄' },
      },
    },
  ],
  trust: [
    {
      prompt: 'Tell the next visitor —',
      optionA: 'the truth',
      optionB: 'a comforting lie',
      consequence: {
        A: { type: 'message', kind: 'truth' },
        B: { type: 'message', kind: 'lie' },
      },
    },
    {
      prompt: 'A whisper claims the verdict is rigged. Do you —',
      optionA: 'trust the Pulse',
      optionB: 'doubt it',
      consequence: {
        A: { type: 'message', kind: 'truth' },
        B: { type: 'artifact', name: 'A Seed of Doubt', icon: '?' },
      },
    },
    {
      prompt: 'Reveal the next dilemma early to —',
      optionA: 'everyone',
      optionB: 'no one',
      consequence: {
        A: { type: 'message', kind: 'truth' },
        B: { type: 'artifact', name: 'A Kept Secret', icon: '※' },
      },
    },
  ],
  time: [
    {
      prompt: 'The collective remembers everything. Should it —',
      optionA: 'reset to Day One',
      optionB: 'keep aging',
      consequence: {
        A: { type: 'reset' },
        B: { type: 'artifact', name: 'An Age Endured', icon: '⧖' },
      },
    },
    (w) => ({
      prompt: `The era of ${w.era ?? 'Dawn'} can be unmade. Run the clock —`,
      optionA: 'backward (undo this era)',
      optionB: 'forward (seal it forever)',
      consequence: {
        A: { type: 'artifact', name: 'An Unmade Era', icon: '↺' },
        B: { type: 'artifact', name: 'A Sealed Era', icon: '⊠' },
      },
    }),
    {
      prompt: 'Freeze the world exactly as it is, or —',
      optionA: 'freeze it now',
      optionB: 'let it decay',
      consequence: {
        A: { type: 'artifact', name: 'A Frozen Moment', icon: '❄' },
        B: { type: 'survival', amount: -3, label: 'The world decays.' },
      },
    },
  ],
  power: [
    {
      prompt: 'A stranger online right now goes silent for 1 hour if B wins. Do you —',
      optionA: 'spare them',
      optionB: 'mute them',
      consequence: {
        A: { type: 'artifact', name: 'An Act of Mercy', icon: '♡' },
        B: { type: 'mute' },
      },
    },
    {
      prompt: 'One soul may rule the next round. Hand the crown to —',
      optionA: 'the majority',
      optionB: 'the lone minority',
      consequence: {
        A: { type: 'artifact', name: 'Crown of the Many', icon: '♔' },
        B: { type: 'artifact', name: 'Crown of the Few', icon: '♚' },
      },
    },
    {
      prompt: 'Strip a random soul of its vote forever?',
      optionA: 'spare its voice',
      optionB: 'take it',
      consequence: {
        A: { type: 'artifact', name: 'A Voice Spared', icon: '♁' },
        B: { type: 'artifact', name: 'A Vote Taken', icon: '⊘' },
      },
    },
  ],
};

// Weight the next theme by the collective's character: a doubting crowd faces
// trust dilemmas, a chaotic one faces destructive ones, a morally extreme one
// faces stakes of life and power.
function chooseTheme(personality) {
  const { trust = 50, chaos = 50, mercy = 50 } = personality || {};
  const w = { survival: 1, identity: 1, trust: 1, time: 1, power: 1 };
  w.trust += Math.max(0, (50 - trust) / 12);
  const ch = Math.max(0, (chaos - 50) / 12);
  w.time += ch;
  w.identity += ch;
  const mc = Math.abs(mercy - 50) / 12;
  w.power += mc;
  w.survival += mc;

  const entries = Object.entries(w);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * sum;
  for (const [theme, weight] of entries) {
    if ((r -= weight) <= 0) return theme;
  }
  return 'survival';
}

export function generateDilemma(world) {
  try {
    const theme = chooseTheme(world?.personality);
    const variants = TEMPLATES[theme];
    const chosen = variants[Math.floor(Math.random() * variants.length)];
    const body = typeof chosen === 'function' ? chosen(world || {}) : chosen;
    return {
      theme,
      prompt: body.prompt,
      optionA: body.optionA,
      optionB: body.optionB,
      consequence: body.consequence,
    };
  } catch (err) {
    console.error('[gen] dilemma generation failed, falling back', err);
    return pickDilemma();
  }
}
