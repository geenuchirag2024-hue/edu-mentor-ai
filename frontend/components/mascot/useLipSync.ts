"use client";

import { useMemo, useRef } from "react";

export interface LipSyncSample {
  /** Smoothed mouth openness 0–1 */
  mouthOpen: number;
  /** Slight width modulation for consonants vs vowels */
  mouthWidth: number;
}

/**
 * Converts raw audio amplitude frames into natural-looking lip motion.
 * Keeps an internal envelope so the mouth doesn't jitter on every sample.
 * Methods are stable across renders (safe for rAF loops).
 */
export function useLipSync() {
  const envelopeRef = useRef(0);
  const widthRef = useRef(1);
  const lastTsRef = useRef(0);
  const phaseRef = useRef(0);

  return useMemo(
    () => ({
      reset() {
        envelopeRef.current = 0;
        widthRef.current = 1;
        lastTsRef.current = 0;
        phaseRef.current = 0;
      },

      /**
       * Feed amplitude (0–1) from AudioPlayer. Returns the smoothed lip pose
       * for the current frame. Safe to call inside requestAnimationFrame.
       */
      sample(level: number, now = performance.now()): LipSyncSample {
        const dt = lastTsRef.current
          ? Math.min(0.05, (now - lastTsRef.current) / 1000)
          : 0.016;
        lastTsRef.current = now;

        // Attack is fast (open mouth quickly); release is slower (looks more natural)
        const target = Math.min(1, Math.max(0, level));
        const attack = 28;
        const release = 9;
        const rate = target > envelopeRef.current ? attack : release;
        envelopeRef.current +=
          (target - envelopeRef.current) * (1 - Math.exp(-rate * dt));

        // Micro-variation so continuous speech doesn't look locked open
        phaseRef.current += dt * 16;
        const flutter =
          1 + Math.sin(phaseRef.current) * 0.08 * envelopeRef.current;

        const mouthOpen = Math.min(1, Math.max(0, envelopeRef.current * 1.55 * flutter));

        // Narrower mouth on quieter / closed moments; wider when open (vowel-like)
        const widthTarget = 0.82 + mouthOpen * 0.42;
        widthRef.current +=
          (widthTarget - widthRef.current) * (1 - Math.exp(-10 * dt));

        return { mouthOpen, mouthWidth: widthRef.current };
      },
    }),
    []
  );
}
