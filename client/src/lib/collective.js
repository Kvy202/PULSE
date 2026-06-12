// Turns the collective's three evolving meters into a measurable character —
// the name the World-Brain has earned from every choice ever made. Rough and
// tunable; this is flavor layered on real, drifting data.

const band = (v) => (v >= 60 ? 'hi' : v <= 40 ? 'lo' : 'mid');

export function collectiveCharacter(personality) {
  if (!personality) {
    return { name: 'THE UNBORN', descriptor: 'No choices have shaped it yet.' };
  }
  const { trust = 50, chaos = 50, mercy = 50 } = personality;
  const t = band(trust);
  const c = band(chaos);
  const m = band(mercy);

  // Ordered rules — first match wins.
  const rules = [
    [c === 'hi' && m === 'lo', 'THE TYRANT', 'It burns without flinching. Order through fear.'],
    [c === 'hi' && m === 'hi', 'THE REVOLUTIONARY', 'It tears down to protect. Mercy with a torch.'],
    [t === 'hi' && m === 'hi', 'THE SHEPHERD', 'It gathers and guards. The crowd trusts itself.'],
    [t === 'hi' && c === 'lo', 'THE KEEPER', 'It preserves what is. Steady, slow, certain.'],
    [m === 'hi' && c === 'lo', 'THE MOTHER', 'It spares before it strikes. Gentle to a fault.'],
    [t === 'lo' && c === 'hi', 'THE TRICKSTER', 'It trusts nothing and risks everything.'],
    [t === 'lo' && m === 'lo', 'THE HOLLOW', 'It has grown cold. Neither faith nor pity remain.'],
    [t === 'hi', 'THE BELIEVER', 'It leans on the collective above all.'],
    [c === 'hi', 'THE STORM', 'It cannot sit still. Change for its own sake.'],
    [m === 'hi', 'THE SAINT', 'Compassion is its first instinct.'],
  ];

  for (const [cond, name, descriptor] of rules) {
    if (cond) return { name, descriptor };
  }
  return { name: 'THE SLEEPER', descriptor: 'Still balanced. Still deciding what it is.' };
}

export const TRAITS = [
  { key: 'trust', label: 'TRUST', color: '#18e0ff' },
  { key: 'chaos', label: 'CHAOS', color: '#ff3d7f' },
  { key: 'mercy', label: 'MERCY', color: '#b061ff' },
];
