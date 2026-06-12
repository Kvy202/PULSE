// ── PULSE gameplay tuning ────────────────────────────────────────────────────
// Every "magic number" that shapes how the experiment feels lives here, in one
// place, so it can be tuned against a real crowd without hunting through logic.
//
// These are deliberate starting points, not empirically calibrated values — once
// real vote distributions exist, adjust here and nowhere else.

export const TUNING = {
  // How many votes a soul must cast before it earns an alignment (Layer 2).
  revealAt: 5,

  // Alignment cutoffs on a soul's minorityRate (share of votes spent on the
  // losing side). Ordered low→high: a soul that almost always backs the winner
  // is a Guardian; one that almost always defies the crowd is a Contrarian.
  //   rate >= contrarian        -> Contrarian
  //   rate >= gambler           -> Gambler
  //   rate <= guardian          -> Guardian
  //   otherwise                 -> Martyr
  alignment: {
    contrarian: 0.6,
    gambler: 0.4,
    guardian: 0.15,
  },

  // Personality drift. Each resolved round nudges trust/chaos/mercy by a theme
  // effect (see personality.js) times this scale. `magnitude` is the master dial
  // for how fast the collective develops a character — raise it to make the
  // World-Brain's personality form faster, lower it for a slower burn.
  personality: {
    magnitude: 1,
    scaleMin: 0.4, // even a perfect coin-flip nudges character this much
    scaleRange: 0.6, // ...up to (scaleMin + scaleRange) for a total landslide
  },

  // Named eras the world ages through, by round number (first match wins).
  eras: [
    { until: 10, name: 'Dawn' },
    { until: 30, name: 'Stirring' },
    { until: 60, name: 'Tempest' },
    { until: 100, name: 'Reckoning' },
    { until: Infinity, name: 'Ascendance' },
  ],

  // Live history kept inline on the WorldState doc. The authoritative full
  // history is the Round collection; this is just a bounded recent buffer so the
  // single world document can never grow without limit.
  historyBuffer: 50,
};
