// Living dilemmas (Phase 5). Each round's choice is composed from the crowd's
// current character — its personality, era, and survival — so the experiment
// "writes itself" as the collective evolves. No external model is required.
//
// Instead of a finite hand-written list, this is a COMBINATORIAL engine: a set
// of curated templates with {slot} placeholders, filled from word banks. A few
// dozen templates × rich banks yields tens of thousands of distinct dilemmas in
// a tiny, fast, maintainable file — and a recent-repeat guard keeps it feeling
// fresh for a very long time before anything recurs.
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

// ── word banks ───────────────────────────────────────────────────────────────
const BANKS = {
  // Tint consequences can only act on real RGB channels.
  color: ['red', 'green', 'blue'],
  // Groups of souls who can be saved, silenced, or crowned.
  people: [
    'the elders', 'the newborns', 'the dreamers', 'the builders', 'the wanderers',
    'the archivists', 'the farmers', 'the soldiers', 'the healers', 'the poets',
    'the miners', 'the sailors', 'the orphans', 'the exiles', 'the twins',
    'the last tribe', 'the night shift', 'the colonists', 'the pilgrims', 'the machinists',
    'the cartographers', 'the gravekeepers', 'the lamplighters', 'the stargazers',
    'the codebreakers', 'the beekeepers', 'the shipwrights', 'the rainmakers',
    'the tunnelers', 'the heretics',
  ],
  // The living world.
  creature: [
    'the whales', 'the bees', 'the wolves', 'the coral', 'the songbirds',
    'the great forests', 'the rivers', 'the glaciers', 'the reefs', 'the old oaks',
    'the fireflies', 'the leviathans', 'the migratory herds', 'the deep fungi',
    'the mountain cats', 'the kelp groves', 'the storm petrels', 'the river dolphins',
    'the ancient lichen', 'the monarch swarms',
  ],
  // Places the crowd can save, seal, or unmake.
  place: [
    'the last city', 'the floating archive', 'the northern colony', 'the sunken library',
    'the desert spire', 'the orbital ring', 'the great dam', 'the seed vault',
    'the hanging gardens', 'the deep harbor', 'the frontier outpost', 'the cathedral of glass',
    'the salt flats', 'the buried metro', 'the cloud farm', 'the obsidian coast',
    'the mirror lake', 'the iron foundry', 'the whispering canyon', 'the tidal vault',
  ],
  // Abstractions that can be erased, sworn, or doubted.
  virtue: [
    'mercy', 'honesty', 'freedom', 'order', 'memory', 'hope', 'justice', 'silence',
    'wonder', 'grief', 'ambition', 'patience', 'forgiveness', 'curiosity', 'loyalty',
    'doubt', 'courage', 'restraint', 'defiance', 'devotion', 'solitude', 'desire',
    'humility', 'vengeance',
  ],
  // Adjectives that color an entity in a choice — the big variety multiplier.
  entityAdj: [
    'doomed', 'fading', 'restless', 'forgotten', 'distant', 'sleeping', 'rising',
    'dying', 'radiant', 'trembling', 'defiant', 'last',
  ],
  resource: ['serum', 'grain', 'power', 'water', 'light', 'fuel', 'medicine', 'signal'],
  // Relic names come from adjective × noun — 22 × 22 = 484 base names.
  relicAdj: [
    'Forgotten', 'Burning', 'Silent', 'Hollow', 'Eternal', 'Broken', 'Gilded', 'Drowned',
    'First', 'Final', 'Whispered', 'Frozen', 'Sacred', 'Cursed', 'Nameless', 'Radiant',
    'Buried', 'Severed', 'Endless', 'Shattered', 'Weeping', 'Unspoken',
  ],
  relicNoun: [
    'Crown', 'Oath', 'Ember', 'Key', 'Mirror', 'Seed', 'Bell', 'Compass', 'Veil', 'Throne',
    'Codex', 'Lantern', 'Chain', 'Mask', 'Sigil', 'Anthem', 'Ledger', 'Beacon', 'Shroud',
    'Gate', 'Spindle', 'Reliquary',
  ],
  relicIcon: ['◆', '✦', '☽', '☄', '♁', '⧖', '✶', '❄', '⊠', '♚', '♔', '☓', '※', '⊘'],
  // Comforting falsehoods (for the lie message).
  lie: [
    'All is well, and it always will be.',
    'You are safe here. Nothing can reach you.',
    'The world has never been kinder.',
    'Every choice you made was the right one.',
    'No one was ever truly lost.',
    'The meter only ever rises.',
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Two distinct picks from a bank.
function pickTwo(bank) {
  const arr = BANKS[bank];
  const a = rand(arr);
  let b = rand(arr);
  let guard = 0;
  while (b === a && guard++ < 12) b = rand(arr);
  return [a, b];
}

// "the {adjective} {entity}" — the main variety multiplier. Entities are stored
// with a leading "the", which we strip so the adjective slots in cleanly.
const ENTITIES = () => [...BANKS.people, ...BANKS.creature, ...BANKS.place];
function phrase(pool) {
  const bare = rand(pool).replace(/^the /, '');
  return `the ${rand(BANKS.entityAdj)} ${bare}`;
}
function pickTwoPhrases(pool) {
  const a = phrase(pool);
  let b = phrase(pool);
  let guard = 0;
  while (b === a && guard++ < 12) b = phrase(pool);
  return [a, b];
}

const relic = () => ({
  name: `The ${rand(BANKS.relicAdj)} ${rand(BANKS.relicNoun)}`,
  icon: rand(BANKS.relicIcon),
});
const truthMsg = (world) => `The truth: survival stands at ${world?.survival ?? 100}.`;

// ── templates, grouped by theme ──────────────────────────────────────────────
// Each builder returns { prompt, optionA, optionB, consequence:{A,B} }. The 5
// themes are unchanged so personality drift and faction logic stay wired.
const THEMES = {
  survival: [
    () => {
      const [a, b] = pickTwoPhrases(ENTITIES());
      return {
        prompt: 'The world has strength to save only one. Spend it on —',
        optionA: cap(a),
        optionB: cap(b),
        consequence: {
          A: { type: 'survival', amount: randInt(2, 5), label: `${cap(a)} endure. The world holds.` },
          B: { type: 'survival', amount: randInt(2, 5), label: `${cap(b)} endure. The world holds.` },
        },
      };
    },
    () => {
      const p = rand(BANKS.place);
      return {
        prompt: `${cap(p)} is failing. Do you —`,
        optionA: `evacuate ${p}`,
        optionB: `fortify ${p}`,
        consequence: {
          A: { type: 'survival', amount: randInt(1, 3), label: `${cap(p)} is emptied, but its people live.` },
          B: { type: 'survival', amount: randInt(2, 5), label: `${cap(p)} stands against the dark.` },
        },
      };
    },
    () => {
      const r = rand(BANKS.resource);
      const [a, b] = pickTwo('people');
      return {
        prompt: `The last ${r} can go to only one. Give it to —`,
        optionA: cap(a),
        optionB: cap(b),
        consequence: {
          A: { type: 'survival', amount: randInt(2, 4), label: `${cap(a)} are sustained.` },
          B: { type: 'survival', amount: randInt(2, 4), label: `${cap(b)} are sustained.` },
        },
      };
    },
    (w) => ({
      prompt: `Survival reads ${w?.survival ?? 100}. The reactor is failing — do you —`,
      optionA: 'vent the core (save the station)',
      optionB: 'seal the wing (save those trapped inside)',
      consequence: {
        A: { type: 'survival', amount: 4, label: 'The station is saved.' },
        B: { type: 'survival', amount: 2, label: 'Those trapped are spared.' },
      },
    }),
    () => {
      const c = rand(BANKS.creature);
      return {
        prompt: `A dying plague jumps to ${c}. Burn the bloom, or let it spread to spare them?`,
        optionA: 'burn the bloom',
        optionB: `spare ${c}`,
        consequence: {
          A: { type: 'survival', amount: randInt(2, 5), label: 'The bloom is burned. The world steadies.' },
          B: { type: 'survival', amount: -randInt(1, 3), label: `${cap(c)} are spared, at a cost.` },
        },
      };
    },
  ],

  identity: [
    () => {
      const [c1, c2] = pickTwo('color');
      return {
        prompt: `The world can keep one hue. Erase ${cap(c1)} or ${cap(c2)} — forever.`,
        optionA: cap(c1),
        optionB: cap(c2),
        consequence: { A: { type: 'tint', remove: c1 }, B: { type: 'tint', remove: c2 } },
      };
    },
    () => {
      const [v1, v2] = pickTwo('virtue');
      return {
        prompt: 'One idea must be struck from the world forever. Erase —',
        optionA: cap(v1),
        optionB: cap(v2),
        consequence: {
          A: { type: 'artifact', name: `The Erasure of ${cap(v1)}`, icon: '☓' },
          B: { type: 'artifact', name: `The Erasure of ${cap(v2)}`, icon: '☓' },
        },
      };
    },
    () => {
      const [p1, p2] = pickTwoPhrases([...BANKS.people, ...BANKS.creature]);
      return {
        prompt: 'Only one voice may carry on. Silence —',
        optionA: cap(p1),
        optionB: cap(p2),
        consequence: {
          A: { type: 'artifact', name: `A Silenced Voice (${cap(p1)})`, icon: '✶' },
          B: { type: 'artifact', name: `A Silenced Voice (${cap(p2)})`, icon: '✶' },
        },
      };
    },
    () => ({
      prompt: 'The collective must wear one face. Erase —',
      optionA: 'who it was',
      optionB: 'who it could become',
      consequence: {
        A: { type: 'artifact', name: 'The Forgotten Past', icon: '☽' },
        B: { type: 'artifact', name: 'The Severed Future', icon: '☄' },
      },
    }),
  ],

  trust: [
    (w) => ({
      prompt: 'Tell the next visitor —',
      optionA: 'the truth',
      optionB: 'a comforting lie',
      consequence: {
        A: { type: 'message', kind: 'truth' },
        B: { type: 'message', kind: 'lie' },
      },
    }),
    () => {
      const p = rand(BANKS.people);
      return {
        prompt: `${cap(p)} claim the verdicts are rigged. Do you —`,
        optionA: 'trust the Pulse',
        optionB: 'doubt it',
        consequence: {
          A: { type: 'message', kind: 'truth' },
          B: { type: 'artifact', name: 'A Seed of Doubt', icon: '?' },
        },
      };
    },
    () => {
      const v = rand(BANKS.virtue);
      return {
        prompt: `Swear the world to ${v}, or keep your options open?`,
        optionA: `swear to ${v}`,
        optionB: 'stay free',
        consequence: {
          A: { type: 'artifact', name: `An Oath of ${cap(v)}`, icon: '♁' },
          B: { type: 'message', kind: 'truth' },
        },
      };
    },
    () => ({
      prompt: 'Reveal the next dilemma early to —',
      optionA: 'everyone',
      optionB: 'no one',
      consequence: {
        A: { type: 'message', kind: 'truth' },
        B: { type: 'artifact', name: 'A Kept Secret', icon: '※' },
      },
    }),
  ],

  time: [
    () => ({
      prompt: 'The collective remembers everything. Should it —',
      optionA: 'reset to Day One',
      optionB: 'keep aging',
      consequence: {
        A: { type: 'reset' },
        B: { type: 'artifact', name: 'An Age Endured', icon: '⧖' },
      },
    }),
    (w) => ({
      prompt: `The era of ${w?.era ?? 'Dawn'} can be unmade. Run the clock —`,
      optionA: 'backward (undo this era)',
      optionB: 'forward (seal it forever)',
      consequence: {
        A: { type: 'artifact', name: 'An Unmade Era', icon: '↺' },
        B: { type: 'artifact', name: 'A Sealed Era', icon: '⊠' },
      },
    }),
    () => {
      const p = rand(BANKS.place);
      return {
        prompt: `Freeze ${p} exactly as it is, or let it decay into memory?`,
        optionA: `freeze ${p}`,
        optionB: 'let it decay',
        consequence: {
          A: { type: 'artifact', name: 'A Frozen Moment', icon: '❄' },
          B: { type: 'survival', amount: -randInt(1, 4), label: `${cap(p)} decays into memory.` },
        },
      };
    },
  ],

  power: [
    () => ({
      prompt: 'A stranger online right now goes silent if B wins. Do you —',
      optionA: 'spare them',
      optionB: 'mute them',
      consequence: {
        A: { type: 'artifact', name: 'An Act of Mercy', icon: '♡' },
        B: { type: 'mute' },
      },
    }),
    () => ({
      prompt: 'One soul may rule the next round. Hand the crown to —',
      optionA: 'the majority',
      optionB: 'the lone minority',
      consequence: {
        A: { type: 'artifact', name: 'Crown of the Many', icon: '♔' },
        B: { type: 'artifact', name: 'Crown of the Few', icon: '♚' },
      },
    }),
    () => {
      const p = rand(BANKS.people);
      return {
        prompt: `Grant ${p} dominion over the next verdict, or scatter the power?`,
        optionA: `crown ${p}`,
        optionB: 'scatter it',
        consequence: {
          A: { type: 'artifact', name: `The Dominion of ${cap(p)}`, icon: '♔' },
          B: { type: 'artifact', name: relic().name, icon: '✦' },
        },
      };
    },
    () => ({
      prompt: 'Strip a random soul of its voice this round?',
      optionA: 'spare its voice',
      optionB: 'silence it',
      consequence: {
        A: { type: 'artifact', name: 'A Voice Spared', icon: '♡' },
        B: { type: 'mute' },
      },
    }),
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

// Recent-repeat guard: remember the last prompts so the same dilemma doesn't
// recur for a long stretch even though selection is random.
const RECENT_MAX = 80;
const recent = [];

function buildOne(world) {
  const theme = chooseTheme(world?.personality);
  const build = rand(THEMES[theme]);
  const body = build(world || {});
  // Truth/lie message text is materialized here from live world state.
  for (const side of ['A', 'B']) {
    const c = body.consequence[side];
    if (c?.type === 'message') {
      c.text = c.kind === 'lie' ? rand(BANKS.lie) : truthMsg(world);
    }
  }
  return { theme, prompt: body.prompt, optionA: body.optionA, optionB: body.optionB, consequence: body.consequence };
}

// Full signature — most variety lives in the options, not the prompt.
const sig = (d) => `${d.prompt}|${d.optionA}|${d.optionB}`;

export function generateDilemma(world) {
  try {
    let d = buildOne(world);
    // Retry a few times to avoid a recently-seen dilemma.
    for (let i = 0; i < 8 && recent.includes(sig(d)); i++) d = buildOne(world);
    recent.push(sig(d));
    if (recent.length > RECENT_MAX) recent.shift();
    return d;
  } catch (err) {
    console.error('[gen] dilemma generation failed, falling back', err);
    return pickDilemma();
  }
}

// Rough lower bound on distinct dilemmas this engine can produce (for docs/tests).
// Dominated by the two adjective × entity templates, whose phrase space is
// |entityAdj| × |entities|, then chosen two-distinct.
export function approxVariety() {
  const n = BANKS;
  const p2 = (a) => a * (a - 1); // ordered distinct pairs
  const entities = n.people.length + n.creature.length + n.place.length;
  const savePhrases = n.entityAdj.length * entities; // "the {adj} {entity}"
  const silencePhrases = n.entityAdj.length * (n.people.length + n.creature.length);
  const survival = p2(savePhrases) + n.place.length + n.resource.length * p2(n.people.length) + 1 + n.creature.length;
  const identity = p2(n.color.length) + p2(n.virtue.length) + p2(silencePhrases) + 1;
  const trust = 1 + n.people.length + n.virtue.length + 1;
  const time = 1 + 1 + n.place.length;
  const relics = n.relicAdj.length * n.relicNoun.length;
  const power = 1 + 1 + n.people.length + 1 + relics;
  return survival + identity + trust + time + power;
}
