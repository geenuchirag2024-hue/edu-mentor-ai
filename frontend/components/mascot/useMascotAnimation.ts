"use client";

import { useEffect, useRef } from "react";
import type { MascotState } from "@/types/voice";
import {
  DEFAULT_POSE,
  STATE_POSES,
  type FacialPose,
} from "./mascotExpressions";
import type { LipSyncSample } from "./useLipSync";

export type PoseListener = (pose: FacialPose) => void;

interface UseMascotAnimationOptions {
  state: MascotState;
  /** Latest lip-sync sample when speaking; ignored otherwise. */
  getLipSync?: () => LipSyncSample | null;
  onPose: PoseListener;
}

/**
 * Single requestAnimationFrame loop driving idle / listening / thinking /
 * speaking motion at ~60 FPS. Updates are pushed via callback so the face
 * can apply them imperatively without React re-renders each frame.
 */
export function useMascotAnimation({
  state,
  getLipSync,
  onPose,
}: UseMascotAnimationOptions) {
  const stateRef = useRef(state);
  stateRef.current = state;

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
      const target = STATE_POSES[currentState];
      const pose = poseRef.current;

      // Smoothly chase state targets so expression changes feel organic
      const ease = 0.12;
      pose.smile = lerp(pose.smile, target.smile ?? pose.smile, ease);
      pose.browRaise = lerp(pose.browRaise, target.browRaise ?? 0, ease);
      pose.gazeX = lerp(pose.gazeX, target.gazeX ?? 0, ease);
      pose.gazeY = lerp(pose.gazeY, target.gazeY ?? 0, ease);
      pose.headRot = lerp(pose.headRot, target.headRot ?? 0, ease * 0.7);
      pose.headNod = lerp(pose.headNod, target.headNod ?? 0, ease * 0.7);
      pose.mouthWidth = lerp(
        pose.mouthWidth,
        target.mouthWidth ?? 1,
        ease
      );

      // --- Idle breathing (always present, quieter while speaking) ---
      const breathAmp = currentState === "speaking" ? 0.008 : 0.018;
      pose.breath = 1 + Math.sin(t * 1.35) * breathAmp;

      // --- Subtle body sway ---
      pose.bodySway =
        Math.sin(t * 0.55) * (currentState === "idle" ? 1.2 : 0.6) +
        Math.sin(t * 0.23) * 0.4;

      // --- Natural blink schedule ---
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
      // Faster blink cadence while listening (attentive feel)
      if (currentState === "listening" && blinkUntilRef.current === 0) {
        // no extra state — blinkNext already random; occasionally shorten gap
      }
      pose.eyeOpen = lerp(pose.eyeOpen, eyeOpen, 0.45);

      // --- State-specific motion layers ---
      if (currentState === "listening") {
        // Soft attentive micro-nod + listening pulse on brows
        pose.headNod = (target.headNod ?? 0) + Math.sin(t * 2.2) * 0.8;
        pose.browRaise = (target.browRaise ?? 0) + Math.sin(t * 3) * 0.4;
        pose.mouthOpen = lerp(pose.mouthOpen, 0, 0.2);
      } else if (currentState === "thinking") {
        // Thoughtful glance + tiny head search
        pose.gazeX = (target.gazeX ?? 0) + Math.sin(t * 1.1) * 1.5;
        pose.headRot = (target.headRot ?? 0) + Math.sin(t * 0.8) * 1.5;
        pose.mouthOpen = lerp(pose.mouthOpen, 0.05 + Math.sin(t * 2) * 0.02, 0.15);
      } else if (currentState === "speaking") {
        const lip = getLipSyncRef.current?.() ?? null;
        if (lip) {
          pose.mouthOpen = lerp(pose.mouthOpen, Math.max(0.06, lip.mouthOpen), 0.55);
          pose.mouthWidth = lerp(pose.mouthWidth, lip.mouthWidth, 0.35);
        } else {
          // Fallback approximate talk if analyser not ready yet
          const talk = 0.15 + Math.abs(Math.sin(t * 14)) * 0.35;
          pose.mouthOpen = lerp(pose.mouthOpen, talk, 0.35);
        }
        // Natural speaking head motion
        pose.headNod = Math.sin(t * 3.4) * 1.6 + Math.sin(t * 5.1) * 0.5;
        pose.headRot = Math.sin(t * 2.1) * 1.8;
        pose.browRaise = (target.browRaise ?? 0) + Math.sin(t * 4.5) * 0.6;
      } else {
        // Idle: gentle smile micro-expression
        pose.mouthOpen = lerp(pose.mouthOpen, 0, 0.2);
        pose.smile = lerp(pose.smile, 0.55 + Math.sin(t * 0.4) * 0.05, 0.08);
        pose.headNod = Math.sin(t * 0.7) * 0.5;
      }

      onPoseRef.current(pose);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
