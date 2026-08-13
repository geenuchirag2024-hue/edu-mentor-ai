"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { MascotState } from "@/types/voice";
import MentorFace, { type MentorFaceHandle } from "./MentorFace";
import MascotStatusRing from "./MascotStatusRing";
import { STATE_LABELS, type FacialPose } from "./mascotExpressions";
import { useLipSync } from "./useLipSync";
import { useMascotAnimation } from "./useMascotAnimation";

interface MascotAvatarProps {
  /** Conversation state from the existing voice pipeline. */
  state: MascotState;
  /**
   * Shared ref written by AudioPlayer's analyser each frame.
   * Preferred over `audioLevel` — avoids React re-renders for lip-sync.
   */
  audioLevelRef?: MutableRefObject<number>;
  /** Fallback amplitude 0–1 when a ref is not provided. */
  audioLevel?: number;
  /** Compact layout for mobile header strip. */
  compact?: boolean;
  /** Show name / status caption under the face. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Production mascot shell for Edu-Mentor AI.
 *
 * Integrates with the existing idle → listening → thinking → speaking
 * state machine without changing any backend APIs. Lip-sync is driven by
 * amplitude samples from the frontend AudioPlayer analyser.
 */
export default function MascotAvatar({
  state,
  audioLevelRef,
  audioLevel = 0,
  compact = false,
  showLabel = true,
  className = "",
}: MascotAvatarProps) {
  const faceRef = useRef<MentorFaceHandle>(null);
  const lipSync = useLipSync();
  const localLevelRef = useRef(0);
  const wasSpeakingRef = useRef(false);

  // Mirror prop-based level when a shared ref is not used
  useEffect(() => {
    if (!audioLevelRef) {
      localLevelRef.current = audioLevel;
    }
  }, [audioLevel, audioLevelRef]);

  const readLevel = useCallback(() => {
    return audioLevelRef?.current ?? localLevelRef.current;
  }, [audioLevelRef]);

  const getLipSync = useCallback(() => {
    if (state !== "speaking") {
      if (wasSpeakingRef.current) {
        lipSync.reset();
        wasSpeakingRef.current = false;
      }
      return null;
    }
    wasSpeakingRef.current = true;
    return lipSync.sample(readLevel());
  }, [state, lipSync, readLevel]);

  const onPose = useCallback((pose: FacialPose) => {
    faceRef.current?.applyPose(pose);
  }, []);

  useMascotAnimation({ state, getLipSync, onPose });

  const size = compact ? 120 : 220;

  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
      data-mascot-state={state}
    >
      {/* Stage — status rings + face */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <MascotStatusRing state={state} />
        <MentorFace ref={faceRef} size={size} className="relative z-10" />
      </div>

      {showLabel && (
        <div className={`text-center ${compact ? "mt-1" : "mt-3"}`}>
          <p
            className={`font-semibold text-slate-800 ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            Mentor Mira
          </p>
          <p
            className={`capitalize transition-colors duration-300 ${
              compact ? "text-[11px]" : "text-xs"
            } ${
              state === "listening"
                ? "text-emerald-600"
                : state === "thinking"
                  ? "text-amber-600"
                  : state === "speaking"
                    ? "text-indigo-600"
                    : "text-slate-500"
            }`}
          >
            {STATE_LABELS[state]}
          </p>
        </div>
      )}
    </div>
  );
}
