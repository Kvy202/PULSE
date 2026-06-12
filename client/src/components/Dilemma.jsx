import { useEffect, useState } from 'react';

// The choice + a countdown derived from the server's endsAt timestamp, so every
// client's clock agrees regardless of when they joined.
function useCountdown(endsAt) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}

export default function Dilemma({ round, hasVoted, onVote, locked, muted }) {
  const remaining = useCountdown(round?.endsAt);

  if (!round) {
    return <div className="dilemma dilemma--waiting">Awaiting the next pulse…</div>;
  }

  const seconds = (remaining / 1000).toFixed(1);
  const closed = remaining <= 0 || locked || muted;
  const urgent = remaining > 0 && remaining <= 5000; // final-seconds tension

  return (
    <div className="dilemma">
      <div className="dilemma__meta">
        <span>HEARTBEAT #{round.roundNumber}</span>
        {round.dilemma.theme && <span className="dilemma__theme">{round.dilemma.theme}</span>}
        <span className={`dilemma__clock${urgent ? ' dilemma__clock--urgent' : ''}`}>{seconds}s</span>
      </div>

      <h1 className="dilemma__prompt">{round.dilemma.prompt}</h1>

      <div className="dilemma__choices">
        <button
          className="choice choice--a"
          disabled={hasVoted || closed}
          onClick={() => onVote('A')}
        >
          <span className="choice__key">A</span>
          {round.dilemma.optionA}
        </button>
        <button
          className="choice choice--b"
          disabled={hasVoted || closed}
          onClick={() => onVote('B')}
        >
          <span className="choice__key">B</span>
          {round.dilemma.optionB}
        </button>
      </div>

      {muted ? (
        <p className="dilemma__status dilemma__status--muted">
          ✕ You have been silenced. Your voice won’t count this round.
        </p>
      ) : (
        hasVoted && <p className="dilemma__status">Your pulse is in the swarm.</p>
      )}
    </div>
  );
}
