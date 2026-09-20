export default function TypingIndicator() {
  return (
    <div className="mira-think-line">
      <img
        src="/mascot/mira-think.jpg"
        alt=""
        className="h-10 w-10 rounded-full object-cover object-top shadow-sm ring-2 ring-white"
      />
      <span className="text-sm font-medium">Mentor Mira is thinking...</span>
      <span className="mira-think-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
