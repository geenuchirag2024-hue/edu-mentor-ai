"use client";

import type { MascotState } from "@/types/voice";

interface MascotStatusRingProps {
  state: MascotState;
}

/**
 * Decorative status aura around the mentor:
 * - listening: expanding mic rings
 * - thinking: orbiting dots
 * - speaking: soft voice glow
 */
export default function MascotStatusRing({ state }: MascotStatusRingProps) {
  if (state === "idle") return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      {state === "listening" && (
        <>
          <span className="mascot-ring mascot-ring-listen" />
          <span className="mascot-ring mascot-ring-listen mascot-ring-delay" />
          {/* Mic indicator */}
          <span className="absolute bottom-[12%] flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
          </span>
        </>
      )}

      {state === "thinking" && (
        <div className="mascot-think-orbit">
          <span className="mascot-think-dot" />
          <span className="mascot-think-dot" />
          <span className="mascot-think-dot" />
        </div>
      )}

      {state === "speaking" && (
        <>
          <span className="mascot-ring mascot-ring-speak" />
          <span className="absolute bottom-[10%] flex gap-1">
            <span className="mascot-voice-bar" />
            <span className="mascot-voice-bar mascot-voice-bar-2" />
            <span className="mascot-voice-bar mascot-voice-bar-3" />
            <span className="mascot-voice-bar mascot-voice-bar-4" />
          </span>
        </>
      )}
    </div>
  );
}
