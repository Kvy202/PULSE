import { alignmentMeta } from '../lib/alignments.js';

// Layer 3: the tribes, locked in a live tug-of-war. Each row shows how a faction
// is splitting its vote toward A vs B *this round*, plus its all-time war wins.
const FACTION_ORDER = ['Guardian', 'Gambler', 'Contrarian', 'Martyr'];

function FactionRow({ name, lean, wins, mine }) {
  const meta = alignmentMeta(name);
  const a = lean?.A ?? 0;
  const b = lean?.B ?? 0;
  const total = a + b;
  const aPct = total === 0 ? 50 : (a / total) * 100;

  return (
    <div className={`faction${mine ? ' faction--mine' : ''}`} style={{ '--ac': meta.color }}>
      <div className="faction__head">
        <span className="faction__name">{meta.title}{mine ? ' ·you' : ''}</span>
        <span className="faction__wins">{wins}w</span>
      </div>
      <div className="faction__bar">
        <div className="faction__fill faction__fill--a" style={{ width: `${aPct}%` }} />
        <div className="faction__fill faction__fill--b" style={{ width: `${100 - aPct}%` }} />
      </div>
      <div className="faction__counts">
        <span>{a}</span>
        <span className="faction__total">{total === 0 ? 'silent' : `${total} voting`}</span>
        <span>{b}</span>
      </div>
    </div>
  );
}

export default function Factions({ factions, standings, myAlignment }) {
  return (
    <section className="factions">
      <div className="factions__title">THE TRIBES · live tug-of-war &nbsp;<span>A ◄ ► B</span></div>
      <div className="factions__grid">
        {FACTION_ORDER.map((name) => (
          <FactionRow
            key={name}
            name={name}
            lean={factions?.[name]}
            wins={standings?.[name]?.wins ?? 0}
            mine={myAlignment === name}
          />
        ))}
      </div>
    </section>
  );
}
