"use client";

import { useEffect, useRef } from "react";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";
import {
  DEFAULT_POSE,
  EMOTION_POSES,
  GESTURE_ARMS,
  STATE_POSES,
  type FacialPose,
} from "./mascotExpressions";
import type { LipSyncSample } from "./useLipSync";

export type PoseListener = (pose: FacialPose) => void;

interface UseMascotAnimationOptions {
  state: MascotState;
  emotion?: MascotEmotion;
  gesture?: MascotGesture;
  /** Latest lip-sync sample when speaking; ignored otherwise. */
  getLipSync?: () => LipSyncSample | null;
  onPose: PoseListener;
}

function mergeTarget(
  state: MascotState,
  emotion: MascotEmotion,
  gesture: MascotGesture
): Partial<FacialPose> {
  return {
    ...STATE_POSES[state],
    ...EMOTION_POSES[emotion],
    ...GESTURE_ARMS[gesture],
  };
}

/** Minimum ms between frames. Thinking is slowest so LLM generation stays responsive. */
const FRAME_GAP: Record<MascotState, number> = {
  speaking: 16,
  listening: 33,
  idle: 42,
  thinking: 70,
};

/**
 * Single requestAnimationFrame loop driving idle / listening / thinking /
 * speaking motion. Pauses when the tab is hidden and throttles FPS by state
 * so the mascot does not compete with answer generation.
 */
export function useMascotAnimation({
  state,
  emotion = "neutral",
  gesture = "none",
  getLipSync,
  onPose,
}: UseMascotAnimationOptions) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;
  const gestureRef = useRef(gesture);
  gestureRef.current = gesture;

  const getLipSyncRef = useRef(getLipSync);
  getLipSyncRef.current = getLipSync;

  const onPoseRef = useRef(onPose);
  onPoseRef.current = onPose;

  const poseRef = useRef<FacialPose>({ ...DEFAULT_POSE });
  const blinkNextRef = useRef(0);
  const blinkUntilRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let lastFrame = 0;
    let paused = typeof document !== "undefined" && document.hidden;
    startRef.current = performance.now();
    blinkNextRef.current = performance.now() + 1800 + Math.random() * 2800;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = (now: number) => {
      if (paused) return;

      const currentState = stateRef.current;
      const inBlink =
        blinkUntilRef.current > 0 || now >= blinkNextRef.current;
      const gap = reduced ? 100 : FRAME_GAP[currentState];
      if (!inBlink && now - lastFrame < gap) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;

      const t = (now - startRef.current) / 1000;
      const currentEmotion = emotionRef.current;
      const currentGesture = gestureRef.current;
      const target = mergeTarget(currentState, currentEmotion, currentGesture);
      const pose = poseRef.current;
      const motion = reduced ? 0.15 : 1;

      const ease = 0.12;
      pose.smile = lerp(pose.smile, target.smile ?? pose.smile, ease);
      pose.browRaise = lerp(pose.browRaise, target.browRaise ?? 0, ease);
      pose.browSkew = lerp(pose.browSkew, target.browSkew ?? 0, ease);
      pose.gazeX = lerp(pose.gazeX, target.gazeX ?? 0, ease);
      pose.gazeY = lerp(pose.gazeY, target.gazeY ?? 0, ease);
      pose.headRot = lerp(pose.headRot, target.headRot ?? 0, ease * 0.7);
      pose.headNod = lerp(pose.headNod, target.headNod ?? 0, ease * 0.7);
      pose.mouthWidth = lerp(pose.mouthWidth, target.mouthWidth ?? 1, ease);
      pose.blush = lerp(pose.blush, target.blush ?? 0.15, ease);
      pose.armLeft = lerp(pose.armLeft, target.armLeft ?? 8, ease * 0.85);
      pose.armRight = lerp(pose.armRight, target.armRight ?? -8, ease * 0.85);

      const breathAmp =
        (currentState === "speaking" ? 0.004 : 0.01) * motion;
      pose.breath = 1 + Math.sin(t * 1.15) * breathAmp;

      pose.bodySway =
        (Math.sin(t * 0.45) * (currentState === "idle" ? 0.55 : 0.28) +
          Math.sin(t * 0.19) * 0.18) *
        motion;

      let eyeOpen = target.eyeOpen ?? 1;
      if (now >= blinkNextRef.current && blinkUntilRef.current === 0) {
        blinkUntilRef.current = now + 130;
        blinkNextRef.current = now + 2400 + Math.random() * 4000;
      }
      if (blinkUntilRef.current > 0) {
        const blinkProgress =
          1 - Math.abs(now + 65 - blinkUntilRef.current) / 65;
        eyeOpen = Math.max(0.05, 1 - Math.min(1, blinkProgress) * 0.95);
        if (now >= blinkUntilRef.current) {
          blinkUntilRef.current = 0;
        }
      }
      pose.eyeOpen = lerp(pose.eyeOpen, eyeOpen, 0.45);

      if (currentState === "listening") {
        pose.headNod =
          (target.headNod ?? 0) + Math.sin(t * 1.55) * 0.32 * motion;
        pose.browRaise =
          (target.browRaise ?? 0) + Math.sin(t * 2.05) * 0.14 * motion;
        pose.mouthOpen = lerp(pose.mouthOpen, target.mouthOpen ?? 0, 0.2);
      } else if (currentState === "thinking") {
        pose.gazeX =
          (target.gazeX ?? 0) + Math.sin(t * 0.65) * 0.7 * motion;
        pose.headRot =
          (target.headRot ?? 0) + Math.sin(t * 0.5) * 0.65 * motion;
        pose.mouthOpen = lerp(pose.mouthOpen, 0.02, 0.18);
      } else if (currentState === "speaking") {
        const lip = getLipSyncRef.current?.() ?? null;
        const chatter =
          (0.14 +
            Math.abs(Math.sin(t * 13.2)) * 0.42 +
            Math.abs(Math.sin(t * 21.0)) * 0.2) *
          motion;
        const driven = lip ? lip.mouthOpen : 0;
        // Follow audio when present; keep a speech rhythm so lips never freeze
        // if the analyser drops a frame.
        const open =
          driven > 0.045 ? Math.min(1, driven * 1.08 + chatter * 0.18) : chatter;
        pose.mouthOpen = lerp(pose.mouthOpen, open, 0.72);
        if (lip) {
          pose.mouthWidth = lerp(pose.mouthWidth, lip.mouthWidth, 0.45);
        }
        pose.headNod =
          (Math.sin(t * 2.1) * 0.45 + Math.sin(t * 3.2) * 0.12) * motion;
        pose.headRot = Math.sin(t * 1.35) * 0.55 * motion;
        pose.browRaise =
          (target.browRaise ?? 0) + Math.sin(t * 2.4) * 0.12 * motion;
      } else {
        pose.mouthOpen = lerp(pose.mouthOpen, target.mouthOpen ?? 0, 0.2);
        pose.smile = lerp(
          pose.smile,
          (target.smile ?? 0.55) + Math.sin(t * 0.35) * 0.04,
          0.08
        );
        pose.headNod = Math.sin(t * 0.52) * 0.26 * motion;
      }

      if (currentGesture === "wave") {
        pose.headRot = Math.sin(t * 2.3) * 1.8 * motion;
      } else if (currentGesture === "celebrate") {
        pose.headNod = Math.sin(t * 4.2) * 1.1 * motion;
        pose.breath = 1 + Math.abs(Math.sin(t * 4.8)) * 0.007 * motion;
      } else if (currentGesture === "shake") {
        pose.headRot = Math.sin(t * 6.5) * 3.2 * motion;
      } else if (currentGesture === "nod") {
        pose.headNod = Math.sin(t * 4.2) * 2.1 * motion;
      } else if (currentGesture === "point") {
        pose.headRot = -2.2 * motion;
      } else if (currentGesture === "raise_hand") {
        pose.headRot = 1.6 * motion;
      }

      if (currentEmotion === "surprised" && currentState !== "speaking") {
        pose.mouthOpen = lerp(pose.mouthOpen, 0.4, 0.2);
      }

      onPoseRef.current(pose);
      raf = requestAnimationFrame(tick);
    };

    const onVis = () => {
      paused = document.hidden;
      document.documentElement.classList.toggle("mira-paused", paused);
      if (paused) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        lastFrame = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    if (!paused) raf = requestAnimationFrame(tick);
    else document.documentElement.classList.add("mira-paused");

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.classList.remove("mira-paused");
    };
  }, []);
}
