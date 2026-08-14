"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";
import MentorFace, { type MentorFaceHandle } from "./MentorFace";
import MascotStatusRing from "./MascotStatusRing";
import {
  EMOTION_LABELS,
  STATE_LABELS,
  type FacialPose,
} from "./mascotExpressions";
import { useLipSync } from "./useLipSync";
import { useMascotAnimation } from "./useMascotAnimation";

interface MascotAvatarProps {
  state: MascotState;
  emotion?: MascotEmotion;
  gesture?: MascotGesture;
  audioLevelRef?: MutableRefObject<number>;
  audioLevel?: number;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export default function MascotAvatar({
  state,
  emotion = "neutral",
  gesture = "none",
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

  useMascotAnimation({ state, emotion, gesture, getLipSync, onPose });

  const size = compact ? 120 : 220;
  const caption =
    EMOTION_LABELS[emotion] && state === "idle"
      ? EMOTION_LABELS[emotion]
      : STATE_LABELS[state];

  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
      data-mascot-state={state}
      data-mascot-emotion={emotion}
      data-mascot-gesture={gesture}
    >
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
                    : emotion === "happy" || emotion === "greeting"
                      ? "text-emerald-600"
                      : emotion === "sad"
                        ? "text-sky-600"
                        : "text-slate-500"
            }`}
          >
            {caption}
          </p>
        </div>
      )}
    </div>
  );
}
