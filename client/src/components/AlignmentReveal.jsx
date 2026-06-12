import { alignmentMeta } from '../lib/alignments.js';

// Layer 2: "It's been watching ME." A one-shot, full-screen reveal that fires
// the first time a soul crosses into an alignment. Dismissable — missing the
// next round while you sit with it is thematic, not a bug.
export default function AlignmentReveal({ reveal, onDismiss }) {
  if (!reveal) return null;

  const meta = alignmentMeta(reveal.alignment);
  const minorityPct = Math.round((reveal.minorityRate ?? 0) * 100);
  const rarityPct = reveal.rarity != null ? Math.round(reveal.rarity * 100) : null;

  return (
    <div className="reveal" onClick={onDismiss}>
      <div className="reveal__card" style={{ '--ac': meta.color }} onClick={(e) => e.stopPropagation()}>
        <p className="reveal__eyebrow">THE PULSE HAS BEEN WATCHING YOU</p>
        <h2 className="reveal__title">{meta.title}</h2>
        <p className="reveal__blurb">{meta.blurb}</p>

        <div className="reveal__stats">
          <div className="reveal__stat">
            <span className="reveal__num">{minorityPct}%</span>
            <span className="reveal__lbl">of the time you side with the minority</span>
          </div>
          {rarityPct != null && (
            <div className="reveal__stat">
              <span className="reveal__num">{rarityPct}%</span>
              <span className="reveal__lbl">of souls share your alignment</span>
            </div>
          )}
        </div>

        <button className="reveal__dismiss" onClick={onDismiss}>
          REJOIN THE SWARM
        </button>
      </div>
    </div>
  );
}
