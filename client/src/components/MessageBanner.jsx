// A message the last crowd sealed for whoever arrives next (Layer 4). The
// arriving soul sees the words but is never told whether it was truth or a lie.
export default function MessageBanner({ message }) {
  if (!message?.text) return null;
  return (
    <div className="msgbanner">
      <span className="msgbanner__tag">THE LAST CROWD LEFT WORD</span>
      <span className="msgbanner__text">“{message.text}”</span>
    </div>
  );
}
