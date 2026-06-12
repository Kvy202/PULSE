// Hardcoded dilemma pool for Phase 1. Later phases will let an LLM generate
// these from the crowd's emerging personality. Each round picks one at random.
const POOL = [
  {
    prompt: 'A meteor approaches. Spend the world’s last energy to —',
    optionA: 'DEFLECT it (save the city)',
    optionB: 'SHIELD the survivors (save the people)',
    theme: 'survival',
  },
  {
    prompt: 'The world can keep ONE color. Forever delete —',
    optionA: 'Blue',
    optionB: 'Red',
    theme: 'identity',
  },
  {
    prompt: 'Tell the next visitor —',
    optionA: 'The truth',
    optionB: 'A comforting lie',
    theme: 'trust',
  },
  {
    prompt: 'The collective remembers everything. Should it —',
    optionA: 'Reset to Day One',
    optionB: 'Keep aging',
    theme: 'time',
  },
  {
    prompt: 'A stranger online right now goes silent for 1 hour if B wins. Do it?',
    optionA: 'Spare them',
    optionB: 'Mute them',
    theme: 'power',
  },
];

export function pickDilemma() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}
