"use client";

import { useCallback, useState } from "react";
import type { MascotState } from "@/types/voice";

/**
 * Thin state helper used by ChatPage to mirror the voice assistant
 * conversation phase onto the mascot without coupling UI to the hook.
 */
export function useMascotState(initial: MascotState = "idle") {
  const [state, setState] = useState<MascotState>(initial);

  const setIdle = useCallback(() => setState("idle"), []);
  const setListening = useCallback(() => setState("listening"), []);
  const setThinking = useCallback(() => setState("thinking"), []);
  const setSpeaking = useCallback(() => setState("speaking"), []);

  return {
    state,
    setState,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
  };
}
