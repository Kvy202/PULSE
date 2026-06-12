import { useEffect, useRef, useState } from 'react';
import { useSocket } from './hooks/useSocket.js';
import Presence from './components/Presence.jsx';
import Dilemma from './components/Dilemma.jsx';
import WorldBrain from './components/WorldBrain.jsx';
import Verdict from './components/Verdict.jsx';
import AlignmentReveal from './components/AlignmentReveal.jsx';
import Factions from './components/Factions.jsx';
import MetaReveal from './components/MetaReveal.jsx';
import MessageBanner from './components/MessageBanner.jsx';
import WorldPalette, { paletteFilterId } from './components/WorldPalette.jsx';
import AbsenceReveal from './components/AbsenceReveal.jsx';

const META_SEEN_KEY = 'pulse.metaSeen';
const META_AUTO_AT = 8; // resolved rounds of history before the codex unveils itself

export default function App() {
  const {
    connected,
    round,
    verdict,
    world,
    presence,
    hasVoted,
    castVote,
    alignment,
    alignmentReveal,
    dismissReveal,
    factions,
    standings,
    missed,
    dismissMissed,
    muted,
  } = useSocket();

  const [metaOpen, setMetaOpen] = useState(false);

  // The codex unveils itself once, the first time enough history has accrued.
  useEffect(() => {
    const len = world?.history?.length ?? 0;
    if (len >= META_AUTO_AT && !localStorage.getItem(META_SEEN_KEY)) {
      localStorage.setItem(META_SEEN_KEY, '1');
      setMetaOpen(true);
    }
  }, [world]);

  // Keyboard voting: tap A or B. A ref keeps the listener pointed at the latest
  // castVote without re-binding every render.
  const castRef = useRef(castVote);
  castRef.current = castVote;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'a' || e.key === 'A') castRef.current('A');
      else if (e.key === 'b' || e.key === 'B') castRef.current('B');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A lost color drains from the whole world via an SVG filter. It's applied to
  // the inner frame only — NOT an ancestor of the fixed-position overlays, which
  // a filter would otherwise re-anchor and break.
  const filterId = paletteFilterId(world?.palette);
  const frameStyle = filterId ? { filter: `url(#${filterId})` } : undefined;

  return (
    <div className="app">
      <WorldPalette />

      <div className="worldframe" style={frameStyle}>
        <Presence
          count={presence}
          connected={connected}
          world={world}
          alignment={alignment}
          onOpenCodex={() => setMetaOpen(true)}
        />

        <MessageBanner message={world?.lastMessage} />

        <main className="stage">
          {/* The World-Brain is the campfire everyone stares at. The current
              dilemma (or the verdict) is overlaid on top of the living mass. */}
          <div className="brain-wrap">
            <WorldBrain />
            <div className="brain-overlay">
              {verdict ? (
                <Verdict verdict={verdict} round={round} />
              ) : (
                <Dilemma round={round} hasVoted={hasVoted} onVote={castVote} locked={!!verdict} muted={muted} />
              )}
            </div>
          </div>

          <Factions factions={factions} standings={standings} myAlignment={alignment} />
        </main>

        <footer className="footer">
          <button className="footer__codex" onClick={() => setMetaOpen(true)}>
            ◆ THE COLLECTIVE REMEMBERS — open the codex
          </button>
          <div>You can never undo a verdict, and you can never vote alone.</div>
        </footer>
      </div>

      {/* Reveals sit above everything (outside the palette filter). */}
      <AbsenceReveal missed={missed} onDismiss={dismissMissed} />
      <AlignmentReveal reveal={alignmentReveal} onDismiss={dismissReveal} />
      <MetaReveal open={metaOpen} onClose={() => setMetaOpen(false)} artifacts={world?.artifacts} />
    </div>
  );
}
