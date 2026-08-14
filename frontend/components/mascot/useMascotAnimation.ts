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

/**
 * Single requestAnimationFrame loop driving idle / listening / thinking /
 * speaking motion at ~60 FPS, plus emotion overlays and body gestures.
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
    startRef.current = performance.now();
    blinkNextRef.current = performance.now() + 2000 + Math.random() * 3000;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      const currentState = stateRef.current;
      const currentEmotion = emotionRef.current;
      const currentGesture = gestureRef.current;
      const target = mergeTarget(currentState, currentEmotion, currentGesture);
      const pose = poseRef.current;

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

      const breathAmp = currentState === "speaking" ? 0.008 : 0.018;
      pose.breath = 1 + Math.sin(t * 1.35) * breathAmp;

      pose.bodySway =
        Math.sin(t * 0.55) * (currentState === "idle" ? 1.2 : 0.6) +
        Math.sin(t * 0.23) * 0.4;

      let eyeOpen = target.eyeOpen ?? 1;
      if (now >= blinkNextRef.current && blinkUntilRef.current === 0) {
        blinkUntilRef.current = now + 120;
        blinkNextRef.current = now + 2200 + Math.random() * 4200;
      }
      if (blinkUntilRef.current > 0) {
        const blinkProgress = 1 - Math.abs(now + 60 - blinkUntilRef.current) / 60;
        eyeOpen = Math.max(0.05, 1 - Math.min(1, blinkProgress) * 0.95);
        if (now >= blinkUntilRef.current) {
          blinkUntilRef.current = 0;
        }
      }
      pose.eyeOpen = lerp(pose.eyeOpen, eyeOpen, 0.45);

      if (currentState === "listening") {
        pose.headNod = (target.headNod ?? 0) + Math.sin(t * 2.2) * 0.8;
        pose.browRaise = (target.browRaise ?? 0) + Math.sin(t * 3) * 0.4;
        pose.mouthOpen = lerp(pose.mouthOpen, target.mouthOpen ?? 0, 0.2);
      } else if (currentState === "thinking") {
        pose.gazeX = (target.gazeX ?? 0) + Math.sin(t * 1.1) * 1.5;
        pose.headRot = (target.headRot ?? 0) + Math.sin(t * 0.8) * 1.5;
        pose.mouthOpen = lerp(
          pose.mouthOpen,
          0.05 + Math.sin(t * 2) * 0.02,
          0.15
        );
      } else if (currentState === "speaking") {
        const lip = getLipSyncRef.current?.() ?? null;
        if (lip) {
          pose.mouthOpen = lerp(pose.mouthOpen, Math.max(0.06, lip.mouthOpen), 0.55);
          pose.mouthWidth = lerp(pose.mouthWidth, lip.mouthWidth, 0.35);
        } else {
          const talk = 0.15 + Math.abs(Math.sin(t * 14)) * 0.35;
          pose.mouthOpen = lerp(pose.mouthOpen, talk, 0.35);
        }
        pose.headNod = Math.sin(t * 3.4) * 1.6 + Math.sin(t * 5.1) * 0.5;
        pose.headRot = Math.sin(t * 2.1) * 1.8;
        pose.browRaise = (target.browRaise ?? 0) + Math.sin(t * 4.5) * 0.6;
      } else {
        pose.mouthOpen = lerp(pose.mouthOpen, target.mouthOpen ?? 0, 0.2);
        pose.smile = lerp(
          pose.smile,
          (target.smile ?? 0.55) + Math.sin(t * 0.4) * 0.05,
          0.08
        );
        pose.headNod = Math.sin(t * 0.7) * 0.5;
      }

      // Gesture motion layers (on top of state)
      if (currentGesture === "wave") {
        pose.armRight = -90 + Math.sin(t * 9) * 28;
        pose.headRot = Math.sin(t * 3) * 4;
      } else if (currentGesture === "celebrate") {
        pose.armLeft = -120 + Math.sin(t * 10) * 12;
        pose.armRight = 120 + Math.sin(t * 10 + 1) * 12;
        pose.headNod = Math.sin(t * 8) * 3;
      } else if (currentGesture === "shake") {
        pose.headRot = Math.sin(t * 10) * 9;
      } else if (currentGesture === "nod") {
        pose.headNod = Math.sin(t * 6) * 5;
      } else if (currentGesture === "point") {
        pose.armLeft = -52 + Math.sin(t * 2) * 4;
      } else if (currentGesture === "raise_hand") {
        pose.armRight = -118 + Math.sin(t * 3) * 6;
      }

      if (currentEmotion === "surprised" && currentState !== "speaking") {
        pose.mouthOpen = lerp(pose.mouthOpen, 0.4, 0.2);
      }

      onPoseRef.current(pose);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
