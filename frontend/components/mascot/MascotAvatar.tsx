"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";
import MentorFace, {
  type MentorExpression,
  type MentorFaceHandle,
} from "./MentorFace";
import MascotStatusRing, { SpeakingWaveform } from "./MascotStatusRing";
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
  size?: number;
  /** Fill the parent; portrait uses object-fit: contain (2:3). */
  fill?: boolean;
  showLabel?: boolean;
  className?: string;
}

function resolveExpression(
  state: MascotState,
  emotion: MascotEmotion
): MentorExpression {
  if (state === "speaking") return "idle";
  if (state === "listening") return "listen";
  if (state === "thinking") return "think";
  if (emotion === "sad") return "concern";
  if (emotion === "happy" || emotion === "greeting") return "happy";
  if (emotion === "thinking") return "think";
  if (emotion === "confident") return "listen";
  return "idle";
}

export default function MascotAvatar({
  state,
  emotion = "neutral",
  gesture = "none",
  audioLevelRef,
  audioLevel = 0,
  compact = false,
  size,
  fill = false,
  showLabel = true,
  className = "",
}: MascotAvatarProps) {
  const faceRef = useRef<MentorFaceHandle>(null);
  const lipSync = useLipSync();
  const localLevelRef = useRef(0);
  const wasSpeakingRef = useRef(false);

  useEffect(() => {
    if (!audioLevelRef) localLevelRef.current = audioLevel;
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

  const width = size ?? (compact ? 140 : 300);
  const caption =
    EMOTION_LABELS[emotion] && state === "idle"
      ? EMOTION_LABELS[emotion]
      : STATE_LABELS[state];

  const statusTone =
    state === "listening"
      ? "text-emerald-600"
      : state === "thinking"
        ? "text-amber-600"
        : state === "speaking"
          ? "text-indigo-600"
          : "text-slate-500";

  const dotTone =
    state === "listening"
      ? "bg-emerald-500"
      : state === "thinking"
        ? "bg-amber-400"
        : state === "speaking"
          ? "bg-indigo-500"
          : "bg-slate-300";

  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
      data-mascot-state={state}
      data-mascot-emotion={emotion}
      data-mascot-gesture={gesture}
    >
      {showLabel && (
        <div className={`text-center ${compact ? "mb-1" : "mb-2"}`}>
          <p
            className={`font-semibold tracking-tight text-slate-800 ${
              compact ? "text-sm" : "text-[15px]"
            }`}
          >
            Mentor Mira
          </p>
          <p
            className={`mt-0.5 flex items-center justify-center gap-1.5 ${compact ? "text-[11px]" : "text-xs"} ${statusTone}`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotTone} ${state !== "idle" ? "mira-status-pulse" : ""}`} />
            {caption}
            <SpeakingWaveform
              active={state === "speaking"}
              audioLevelRef={audioLevelRef}
            />
          </p>
        </div>
      )}

      <div
        className={`mira-presence ${fill ? "mira-presence-fill" : ""} ${
          state === "speaking" ? "mira-presence-speak" : ""
        } ${state === "listening" ? "mira-presence-listen" : ""}`}
        style={
          fill
            ? undefined
            : { width, height: Math.round(width * 1.5) }
        }
      >
        <MascotStatusRing state={state} audioLevelRef={audioLevelRef} />
        <MentorFace
          ref={faceRef}
          size={fill ? undefined : width}
          expression={resolveExpression(state, emotion)}
          className="relative z-10"
        />
      </div>
    </div>
  );
}
