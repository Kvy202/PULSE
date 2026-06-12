// The darker twist: a returning soul is shown a verdict that passed while it was
// away — strangers decided the world's fate in its absence. Dismissable.
export default function AbsenceReveal({ missed, onDismiss }) {
  if (!missed) return null;
  return (
    <div className="absence" onClick={onDismiss}>
      <div className="absence__card" onClick={(e) => e.stopPropagation()}>
        <p className="absence__eyebrow">YOU WEREN’T HERE</p>
        <h2 className="absence__title">Strangers decided this for you.</h2>
        <p className="absence__detail">
          While you were gone, heartbeat #{missed.roundNumber} resolved to{' '}
          <b>{missed.result}</b>.
        </p>
        <p className="absence__consequence">{missed.label}</p>
        <button className="absence__dismiss" onClick={onDismiss}>
          RETURN TO THE PULSE
        </button>
      </div>
    </div>
  );
}
