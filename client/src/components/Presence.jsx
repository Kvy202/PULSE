import { alignmentMeta } from '../lib/alignments.js';

// The constant reminder that you are never alone in the swarm. Once a soul has
// been profiled, its alignment rides here as a permanent badge. The era acts as
// a doorway into the meta-reveal codex.
export default function Presence({ count, connected, world, alignment, onOpenCodex }) {
  const meta = alignment ? alignmentMeta(alignment) : null;

  return (
    <header className="presence">
      <div className="presence__brand">
        <span className="presence__dot" data-on={connected} />
        NEURAL MESH TERMINAL · est. 2050
      </div>
      <div className="presence__stats">
        {meta && (
          <span className="presence__badge" style={{ '--ac': meta.color }} title="Your alignment">
            {meta.title}
          </span>
        )}
        {world && (
          <button className="presence__era" onClick={onOpenCodex} title="Open the codex">
            ERA · {world.era}
          </button>
        )}
        {world && <span className="presence__survival">SURVIVAL {world.survival}</span>}
        <span className="presence__souls">{count} souls awake</span>
      </div>
    </header>
  );
}
