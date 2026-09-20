/** Reveal spoken words in lockstep with audio progress (0–1). */
export function revealSpokenText(text: string, ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  if (!text) return "";
  if (clamped >= 0.995) return text;

  const parts = text.match(/\S+\s*/g);
  if (!parts || parts.length === 0) return text;

  const count = Math.max(1, Math.ceil(parts.length * clamped));
  return parts.slice(0, count).join("");
}

/** Last complete-enough sentence of the currently revealed text (mascot caption). */
export function currentSpokenCaption(text: string, ratio: number): string {
  const shown = revealSpokenText(text, ratio).trim();
  if (!shown) return "";
  let lastStart = 0;
  for (let i = 0; i < shown.length - 1; i++) {
    if (".!?".includes(shown[i]) && /\s/.test(shown[i + 1])) {
      lastStart = i + 2;
    }
  }
  const last = shown.slice(lastStart).trim() || shown;
  return last.length > 220 ? `${last.slice(0, 217).trimEnd()}…` : last;
}
