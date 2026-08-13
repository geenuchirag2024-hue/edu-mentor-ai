"use client";

import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useMascotState } from "@/components/mascot/useMascotState";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";
import MascotAvatar from "@/components/mascot/MascotAvatar";
import AudioPlayer from "@/components/voice/AudioPlayer";
import type { AudioPlayerHandle } from "@/components/voice/AudioPlayer";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const assistantRef = useRef<ReturnType<typeof useVoiceAssistant> | null>(null);
  const mascot = useMascotState();

  // Shared amplitude bus for lip-sync (written at ~60 FPS, read by mascot rAF)
  const audioLevelRef = useRef(0);

  // Compact mascot on small viewports (size only — component stays mounted)
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onAudioLevel = useCallback((level: number) => {
    audioLevelRef.current = level;
  }, []);

  const onPlaybackEnd = useCallback(() => {
    audioLevelRef.current = 0;
    assistantRef.current?.stopSpeaking();
    mascot.setIdle();
  }, [mascot]);

  const onAudioReady = useCallback((base64: string) => {
    audioPlayerRef.current?.play(base64);
  }, []);

  const assistant = useVoiceAssistant({
    onStateChange: (s) => {
      if (s === "listening") mascot.setListening();
      else if (s === "thinking") mascot.setThinking();
      else if (s === "speaking") mascot.setSpeaking();
      else mascot.setIdle();
    },
    onAudioReady,
    onSpeakingChange: (speaking) => {
      if (!speaking) {
        audioLevelRef.current = 0;
        mascot.setIdle();
      }
    },
  });
  assistantRef.current = assistant;

  const handleStopSpeaking = useCallback(() => {
    audioPlayerRef.current?.stop();
    assistant.stopSpeaking();
    audioLevelRef.current = 0;
    mascot.setIdle();
  }, [assistant, mascot]);

  return (
    <div className="flex h-full flex-col gap-3 md:flex-row md:gap-6">
      {/* Chat column */}
      <div className="order-2 flex min-w-0 flex-1 flex-col md:order-1">
        <ChatWindow
          messages={assistant.messages}
          isProcessing={assistant.isProcessing}
          statusMessage={assistant.statusMessage}
        />
        {assistant.error && (
          <p className="px-4 py-2 text-sm text-red-600">{assistant.error}</p>
        )}
        {assistant.isSpeaking && (
          <div className="flex justify-center px-4 pb-2">
            <button
              type="button"
              onClick={handleStopSpeaking}
              className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
            >
              ■ Stop speaking
            </button>
          </div>
        )}
        <ChatInput
          onSendText={assistant.sendText}
          onSendVoice={assistant.sendVoice}
          disabled={assistant.isProcessing}
          onListeningStart={assistant.startListening}
          onListeningEnd={assistant.stopListening}
          onListeningCancel={assistant.cancelListening}
        />
      </div>

      {/* Mascot — top on mobile, sidebar on desktop; single instance */}
      <aside
        className={`order-1 flex shrink-0 flex-col items-center justify-center md:order-2 ${
          compact
            ? "border-b border-slate-200 py-2"
            : "w-72"
        }`}
      >
        <div
          className={
            compact
              ? ""
              : "rounded-3xl bg-gradient-to-b from-slate-50 to-indigo-50/60 px-4 py-6 shadow-sm ring-1 ring-slate-200/80"
          }
        >
          <MascotAvatar
            state={mascot.state}
            audioLevelRef={audioLevelRef}
            compact={compact}
          />
        </div>
        {!compact && assistant.isSpeaking && (
          <button
            type="button"
            onClick={handleStopSpeaking}
            className="mt-4 rounded-full bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
          >
            Stop voice
          </button>
        )}
      </aside>

      <AudioPlayer
        ref={audioPlayerRef}
        onEnded={onPlaybackEnd}
        onAudioLevel={onAudioLevel}
      />
    </div>
  );
}
