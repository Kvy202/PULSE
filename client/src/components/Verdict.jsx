// The dramatic reveal overlay. When the countdown hits zero the server sends
// round:resolve and this takes over the screen for the 5s reveal window.
export default function Verdict({ verdict, round }) {
  if (!verdict || !round) return null;

  const winner = verdict.result;
  const label = winner === 'A' ? round.dilemma.optionA : round.dilemma.optionB;

  // The bespoke, binding consequence sentence — what this verdict actually did
  // to the world. Falls back to a generic line if none was sent.
  const con = verdict.consequence;
  const consequenceText = con?.label ?? 'The world remembers.';
  const amount = con?.type === 'survival' ? con.payload?.amount : null;

  return (
    <div className="verdict">
      <p className="verdict__tagline">THE PULSE HAS SPOKEN</p>
      <h2 className={`verdict__winner verdict__winner--${winner.toLowerCase()}`}>
        {winner}: {label}
      </h2>
      <p className="verdict__counts">
        {verdict.tally.A} &nbsp;·&nbsp; {verdict.tally.B}
      </p>
      <p className="verdict__consequence">{consequenceText}</p>
      {amount != null && (
        <p className="verdict__delta">
          Survival {amount >= 0 ? '+' : ''}{amount}
        </p>
      )}
    </div>
  );
}
