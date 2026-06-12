import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { getSessionId } from '../lib/session.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const REVEALED_KEY = 'pulse.revealedAlignment';

// Subscribes to the server's heartbeat and exposes the synced view of the
// world plus a castVote action. The server is the source of truth — this hook
// only mirrors what it broadcasts.
export function useSocket() {
  const [connected, setConnected] = useState(socket.connected);
  const [round, setRound] = useState(null);
  const [tally, setTally] = useState({ A: 0, B: 0 });
  const [verdict, setVerdict] = useState(null);
  const [world, setWorld] = useState(null);
  const [presence, setPresence] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  // Phase 4: the soul's emerging profile + the dramatic one-shot reveal.
  const [soul, setSoul] = useState(null);
  const [alignmentReveal, setAlignmentReveal] = useState(null);

  // Layer 3: live faction tug-of-war (per-round A/B split for each tribe).
  const [factions, setFactions] = useState(null);

  // The "you weren't here" twist: a verdict decided in this soul's absence.
  const [missed, setMissed] = useState(null);

  // The power/mute consequence: this soul has been silenced for some rounds.
  const [muted, setMuted] = useState(null);

  // Refs avoid stale closures inside the stable socket handlers.
  const votedRound = useRef(null); // round number this soul locked a vote in
  const roundNumberRef = useRef(null); // the current round number
  const lastRevealed = useRef(localStorage.getItem(REVEALED_KEY)); // last alignment shown

  useEffect(() => {
    // Identity comes from the signed cookie now — no id is sent in the payload.
    const sayHello = () => socket.emit('soul:hello');

    const onConnect = () => {
      setConnected(true);
      sayHello(); // re-identify on every (re)connect
    };
    const onDisconnect = () => setConnected(false);

    const onRoundStart = (payload) => {
      roundNumberRef.current = payload.roundNumber;
      setRound(payload);
      setTally(payload.tally ?? { A: 0, B: 0 });
      setVerdict(null);
      if (votedRound.current !== payload.roundNumber) setHasVoted(false);
      // A mute term ends once we pass the round it was set through.
      setMuted((m) => (m && payload.roundNumber > m.untilRound ? null : m));
    };

    const onMuted = (info) => setMuted(info);

    const onTally = ({ A, B }) => setTally({ A, B });

    const onResolve = async (payload) => {
      setVerdict(payload);
      // Late joiners get a reveal that carries its dilemma context; adopt it so
      // the Verdict can render even though we never saw the round start.
      if (payload.dilemma && roundNumberRef.current !== payload.roundNumber) {
        roundNumberRef.current = payload.roundNumber;
        setRound({
          roundNumber: payload.roundNumber,
          dilemma: payload.dilemma,
          endsAt: payload.endsAt,
          tally: payload.tally,
        });
      }
      // Only profile-fetch if this soul actually voted in the round that just
      // resolved — otherwise their record didn't change.
      if (votedRound.current !== roundNumberRef.current) return;
      const sid = getSessionId();
      if (!sid) return;
      try {
        const res = await fetch(`${SERVER_URL}/api/soul/${sid}`, { credentials: 'include' });
        const data = await res.json();
        if (!data) return;
        setSoul(data);
        // First time we cross into an alignment (or it shifts) → reveal it once.
        if (data.alignment && data.alignment !== lastRevealed.current) {
          lastRevealed.current = data.alignment;
          localStorage.setItem(REVEALED_KEY, data.alignment);
          setAlignmentReveal(data);
        }
      } catch {
        /* network hiccup — the reveal can wait for a later round */
      }
    };

    const onWorld = ({ worldState }) => setWorld(worldState);
    const onPresence = ({ count }) => setPresence(count);
    const onFactions = ({ factions: f }) => setFactions(f);
    // Silent badge sync from the connect handshake (no reveal on reconnect).
    const onSoulState = (profile) => setSoul(profile);
    const onAbsence = (info) => setMissed(info);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('round:start', onRoundStart);
    socket.on('tally:update', onTally);
    socket.on('round:resolve', onResolve);
    socket.on('world:update', onWorld);
    socket.on('presence', onPresence);
    socket.on('faction:update', onFactions);
    socket.on('soul:state', onSoulState);
    socket.on('absence', onAbsence);
    socket.on('muted', onMuted);

    // If we're already connected when the effect runs, greet right away.
    if (socket.connected) sayHello();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('round:start', onRoundStart);
      socket.off('tally:update', onTally);
      socket.off('round:resolve', onResolve);
      socket.off('world:update', onWorld);
      socket.off('presence', onPresence);
      socket.off('faction:update', onFactions);
      socket.off('soul:state', onSoulState);
      socket.off('absence', onAbsence);
      socket.off('muted', onMuted);
    };
  }, []);

  const isMuted = muted && round && round.roundNumber <= muted.untilRound;

  const castVote = (choice) => {
    if (hasVoted || !round || verdict || isMuted) return;
    socket.emit('vote:cast', { choice }); // identity is the signed cookie
    votedRound.current = round.roundNumber;
    setHasVoted(true);
  };

  const dismissReveal = () => setAlignmentReveal(null);
  const dismissMissed = () => setMissed(null);

  // Badge shows the live alignment, falling back to the last one we stored so a
  // returning soul sees their character immediately on load.
  const alignment = soul?.alignment ?? lastRevealed.current;

  return {
    connected,
    round,
    tally,
    verdict,
    world,
    presence,
    hasVoted,
    castVote,
    soul,
    alignment,
    alignmentReveal,
    dismissReveal,
    factions,
    standings: world?.factions ?? null,
    missed,
    dismissMissed,
    muted: Boolean(isMuted),
  };
}
