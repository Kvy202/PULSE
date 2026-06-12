// Character metadata for the Phase 4 alignment reveal. The server decides WHICH
// alignment a soul is (see server/game/alignment.js); this is just how each one
// is presented in the "it's been watching ME" moment.

export const ALIGNMENTS = {
  Guardian: {
    title: 'GUARDIAN',
    color: '#18e0ff',
    blurb: 'You move with the protective majority. You shield what is, and the crowd feels safer for it.',
  },
  Gambler: {
    title: 'GAMBLER',
    color: '#ffd23d',
    blurb: 'You flip a coin with fate. Majority or minority — you simply go where the moment pulls you.',
  },
  Contrarian: {
    title: 'CONTRARIAN',
    color: '#ff3d7f',
    blurb: 'You ride hard against the crowd. Where they surge one way, you are the pulse going the other.',
  },
  Martyr: {
    title: 'MARTYR',
    color: '#b061ff',
    blurb: 'You are often on the losing side — not by rule, but because you refuse to abandon a cause.',
  },
};

export function alignmentMeta(name) {
  return ALIGNMENTS[name] ?? { title: name?.toUpperCase() ?? 'UNKNOWN', color: '#9aa', blurb: '' };
}
