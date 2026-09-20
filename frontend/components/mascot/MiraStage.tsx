"use client";

import type { MutableRefObject, ReactNode } from "react";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";
import MascotAvatar from "./MascotAvatar";
import { SpeakingWaveform } from "./MascotStatusRing";
import { STATE_LABELS } from "./mascotExpressions";

interface MiraStageProps {
  state: MascotState;
  emotion?: MascotEmotion;
  gesture?: MascotGesture;
  audioLevelRef?: MutableRefObject<number>;
  compact?: boolean;
  size?: number;
  fill?: boolean;
  controls?: ReactNode;
  liveCaption?: string | null;
}

export default function MiraStage({
  state,
  emotion,
  gesture,
  audioLevelRef,
  compact = false,
  size,
  fill = false,
  controls,
  liveCaption,
}: MiraStageProps) {
  const speaking = state === "speaking";
  const portrait = size ?? (compact ? 140 : 300);
  const status =
    liveCaption ||
    (state === "idle" ? "AI Learning Assistant" : STATE_LABELS[state]);

  return (
    <div
      className={`mira-presence-panel relative flex min-h-0 flex-col items-center ${
        fill ? "h-full" : "h-full"
      }`}
    >
      {speaking && (
        <div className="mira-speak-chip pointer-events-none absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-md backdrop-blur-md">
          <SpeakingWaveform active audioLevelRef={audioLevelRef} />
          Speaking...
        </div>
      )}
      {state === "listening" && (
        <div className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-md">
          Listening...
        </div>
      )}
      {state === "thinking" && (
        <div className="pointer-events-none absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-violet-700 shadow-md">
          Thinking
          <span className="mira-think-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </div>
      )}
      {state === "idle" && !liveCaption && (
        <div className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
          Ready to help
        </div>
      )}

      <div className="relative flex min-h-0 w-full flex-1 items-stretch justify-center">
        <MascotAvatar
          state={state}
          emotion={emotion}
          gesture={gesture}
          audioLevelRef={audioLevelRef}
          compact={compact}
          size={fill ? undefined : portrait}
          fill={fill}
          showLabel={false}
          className={fill ? "flex h-full min-h-0 w-full" : ""}
        />
      </div>

      <div className="relative z-20 mt-1 w-[min(100%,18rem)] shrink-0 rounded-xl bg-slate-900/80 px-3 py-2 text-white shadow-md backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              state === "listening"
                ? "bg-emerald-400 mira-status-pulse"
                : state === "thinking"
                  ? "bg-amber-400 mira-status-pulse"
                  : state === "speaking"
                    ? "bg-violet-400 mira-status-pulse"
                    : "bg-emerald-400"
            }`}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold">Mentor Mira</p>
            <p className="truncate text-[11px] text-white/75">{status}</p>
          </div>
        </div>
      </div>

      {controls && (
        <div className="relative z-20 mb-0.5 mt-2 shrink-0">{controls}</div>
      )}
    </div>
  );
}
