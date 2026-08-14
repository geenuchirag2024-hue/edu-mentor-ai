"use client";

import { useCallback, useRef, useState } from "react";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

export function useMascotState(initial: MascotState = "idle") {
  const [state, setState] = useState<MascotState>(initial);
  const [emotion, setEmotion] = useState<MascotEmotion>("greeting");
  const [gesture, setGesture] = useState<MascotGesture>("wave");
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIdle = useCallback(() => setState("idle"), []);
  const setListening = useCallback(() => setState("listening"), []);
  const setThinking = useCallback(() => setState("thinking"), []);
  const setSpeaking = useCallback(() => setState("speaking"), []);

  const applyCues = useCallback(
    (nextEmotion?: MascotEmotion | null, nextGesture?: MascotGesture | null) => {
      if (nextEmotion) setEmotion(nextEmotion);
      if (nextGesture) setGesture(nextGesture);
      if (cueTimer.current) clearTimeout(cueTimer.current);
      cueTimer.current = setTimeout(() => {
        setGesture("none");
        setEmotion((e) => (e === "greeting" ? "neutral" : e));
      }, 4200);
    },
    []
  );

  const resetCues = useCallback(() => {
    setEmotion("neutral");
    setGesture("none");
  }, []);

  return {
    state,
    emotion,
    gesture,
    setState,
    setEmotion,
    setGesture,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
    applyCues,
    resetCues,
  };
}
