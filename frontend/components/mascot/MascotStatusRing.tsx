"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { MascotState } from "@/types/voice";

interface MascotStatusRingProps {
  state: MascotState;
  audioLevelRef?: MutableRefObject<number>;
}

export default function MascotStatusRing({
  state,
  audioLevelRef,
}: MascotStatusRingProps) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (state !== "speaking") return;
    let raf = 0;
    const tick = () => {
      const level = audioLevelRef?.current ?? 0;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const spread = 0.22 + ((i * 17) % 10) / 40;
        const scale = 0.22 + level * (0.55 + spread);
        el.style.transform = `scaleY(${scale.toFixed(3)})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, audioLevelRef]);

  if (state === "idle") return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      aria-hidden
    >
      {state === "listening" && (
        <>
          <span className="mascot-ring mascot-ring-listen" />
          <span className="mascot-ring mascot-ring-listen mascot-ring-delay" />
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
        <span className="mascot-ring mascot-ring-speak" />
      )}
    </div>
  );
}

export function SpeakingWaveform({
  audioLevelRef,
  active,
}: {
  audioLevelRef?: MutableRefObject<number>;
  active: boolean;
}) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const level = audioLevelRef?.current ?? 0;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const spread = 0.18 + ((i * 13) % 11) / 36;
        el.style.transform = `scaleY(${(0.2 + level * (0.8 + spread)).toFixed(3)})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, audioLevelRef]);

  if (!active) return null;

  return (
    <span className="mira-eq" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="mira-eq-bar"
        />
      ))}
    </span>
  );
}
