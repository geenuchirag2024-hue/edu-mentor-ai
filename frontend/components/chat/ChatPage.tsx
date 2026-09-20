"use client";

import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useMascotState } from "@/components/mascot/useMascotState";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";
import MiraStage from "@/components/mascot/MiraStage";
import AudioPlayer from "@/components/voice/AudioPlayer";
import type { AudioPlayerHandle } from "@/components/voice/AudioPlayer";
import ModeSelector from "@/components/tutor/ModeSelector";
import MicButton from "@/components/voice/MicButton";
import { currentSpokenCaption } from "@/components/chat/speechReveal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function ChatPage() {
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const assistantRef = useRef<ReturnType<typeof useVoiceAssistant> | null>(null);
  const mascot = useMascotState();
  const audioLevelRef = useRef(0);

  const [compact, setCompact] = useState(false);
  const [speakRatio, setSpeakRatio] = useState(1);
  const lastProgressAt = useRef(0);
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
    setSpeakRatio(1);
    assistantRef.current?.stopSpeaking();
    mascot.setIdle();
  }, [mascot]);

  const onAudioProgress = useCallback((current: number, duration: number) => {
    const now = performance.now();
    if (now - lastProgressAt.current < 40 && current < duration - 0.05) return;
    lastProgressAt.current = now;
    setSpeakRatio(duration > 0 ? Math.min(1, current / duration) : 0);
  }, []);

  const onAudioReady = useCallback((base64: string) => {
    setSpeakRatio(0);
    lastProgressAt.current = 0;
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
    onCues: (emotion, gesture) => mascot.applyCues(emotion, gesture),
  });
  assistantRef.current = assistant;

  const handleStopSpeaking = useCallback(() => {
    audioPlayerRef.current?.stop();
    assistant.cancelTurn();
    assistant.stopSpeaking();
    audioLevelRef.current = 0;
    setSpeakRatio(1);
    mascot.setIdle();
  }, [assistant, mascot]);

  const replayAnswer = useCallback(
    (text: string, messageId?: string) => {
      if (!text.trim()) return;
      audioPlayerRef.current?.stop();
      setSpeakRatio(0);
      void assistant.playAnswerAudio(text, undefined, messageId);
    },
    [assistant]
  );

  const togglePlayback = useCallback(() => {
    if (assistant.isSpeaking || assistant.isProcessing) {
      handleStopSpeaking();
      return;
    }
    const last = [...assistant.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.trim());
    if (last) replayAnswer(last.content, last.id);
  }, [assistant, handleStopSpeaking, replayAnswer]);

  const spokenMessage = useMemo(
    () => assistant.messages.find((m) => m.id === assistant.speakingMessageId),
    [assistant.messages, assistant.speakingMessageId]
  );
  const liveCaption =
    assistant.isSpeaking && spokenMessage
      ? currentSpokenCaption(spokenMessage.content, speakRatio)
      : null;

  useEffect(() => {
    if (assistant.error) mascot.setEmotion("sad");
  }, [assistant.error, mascot.setEmotion]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,28vh)_minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,34%)] md:grid-rows-[minmax(0,1fr)] md:gap-4">
      <section className="glass-panel order-2 flex min-h-0 min-w-0 flex-col overflow-hidden md:order-1">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100/80 px-4 py-2.5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Chat with Mentor Mira</h2>
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Your AI tutor for Machine Learning & more
              </p>
            </div>
          </div>
          <ModeSelector
            compact
            value={assistant.tutorMode}
            onChange={assistant.setTutorMode}
          />
        </div>

        <ChatWindow
          messages={assistant.messages}
          isProcessing={assistant.isProcessing}
          statusMessage={assistant.statusMessage}
          tutorMode={assistant.tutorMode}
          onSpeak={replayAnswer}
          speech={{
            messageId: assistant.speakingMessageId,
            ratio: speakRatio,
            active: assistant.isSpeaking,
          }}
        />

        {assistant.error && (
          <p className="px-5 py-2 text-sm text-red-600">{assistant.error}</p>
        )}

        <ChatInput
          onSendText={assistant.sendText}
          onSendVoice={assistant.sendVoice}
          disabled={assistant.isProcessing}
          onListeningStart={assistant.startListening}
          onListeningEnd={assistant.stopListening}
          onListeningCancel={assistant.cancelListening}
        />
      </section>

      <aside className="order-1 flex min-h-0 min-w-0 flex-col md:order-2">
        <MiraStage
          state={mascot.state}
          emotion={mascot.emotion}
          gesture={mascot.gesture}
          audioLevelRef={audioLevelRef}
          fill
          compact={compact}
          liveCaption={liveCaption}
          controls={
            <div className="flex items-center gap-2 rounded-full bg-slate-900/85 px-2 py-1.5 shadow-xl backdrop-blur-md">
              <MicButton
                variant="dock"
                onRecordingComplete={assistant.sendVoice}
                disabled={assistant.isProcessing}
                onListeningStart={assistant.startListening}
                onListeningEnd={assistant.stopListening}
                onListeningCancel={assistant.cancelListening}
              />
              <button
                type="button"
                onClick={togglePlayback}
                disabled={
                  !assistant.isSpeaking &&
                  !assistant.isProcessing &&
                  !assistant.messages.some((m) => m.role === "assistant" && m.content.trim())
                }
                className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-400 disabled:opacity-40"
                title={assistant.isSpeaking ? "Pause speech" : "Play last answer"}
              >
                {assistant.isSpeaking ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => assistant.setHintLevel(assistant.hintLevel > 0 ? 0 : 1)}
                title={assistant.hintLevel > 0 ? "Hint mode on" : "Hint mode"}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  assistant.hintLevel > 0
                    ? "bg-amber-400 text-amber-950"
                    : "text-white/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </button>
            </div>
          }
        />
      </aside>

      <AudioPlayer
        ref={audioPlayerRef}
        onEnded={onPlaybackEnd}
        onAudioLevel={onAudioLevel}
        onProgress={onAudioProgress}
      />
    </div>
  );
}
