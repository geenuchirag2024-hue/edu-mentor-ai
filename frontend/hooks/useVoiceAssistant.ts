"use client";

import { useCallback, useRef, useState } from "react";
import { streamChatMessage } from "@/services/chatService";
import { sendVoiceQuery, synthesizeSpeech } from "@/services/voiceService";
import { getLearnerId } from "@/services/learner";
import type { ChatMessage } from "@/types/chat";
import type { TutorMode } from "@/types/tutor";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UseVoiceAssistantOptions {
  onStateChange?: (state: MascotState) => void;
  onAudioReady?: (base64: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onCues?: (emotion?: MascotEmotion, gesture?: MascotGesture) => void;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutorMode, setTutorMode] = useState<TutorMode>("teacher");
  const [hintLevel, setHintLevel] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const tutorModeRef = useRef(tutorMode);
  tutorModeRef.current = tutorMode;
  const hintLevelRef = useRef(hintLevel);
  hintLevelRef.current = hintLevel;

  const setMascot = useCallback((state: MascotState) => {
    optionsRef.current.onStateChange?.(state);
  }, []);

  const addMessage = useCallback(
    (
      role: "user" | "assistant",
      content: string,
      sources?: string[],
      isVoice?: boolean
    ) => {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role, content, timestamp: new Date(), sources, isVoice },
      ]);
    },
    []
  );

  const startListening = useCallback(() => {
    setError(null);
    setStatusMessage("Listening — speak now...");
    setMascot("listening");
  }, [setMascot]);

  const stopListening = useCallback(() => {
    setStatusMessage("Transcribing...");
    setMascot("thinking");
  }, [setMascot]);

  const cancelListening = useCallback(() => {
    setStatusMessage(null);
    setMascot("idle");
  }, [setMascot]);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    optionsRef.current.onSpeakingChange?.(false);
    setMascot("idle");
  }, [setMascot]);

  const playAnswerAudio = useCallback(
    async (answer: string) => {
      try {
        setStatusMessage("Speaking...");
        const audioBase64 = await synthesizeSpeech(answer);
        if (!audioBase64) {
          setMascot("idle");
          return;
        }
        setIsSpeaking(true);
        optionsRef.current.onSpeakingChange?.(true);
        setMascot("speaking");
        optionsRef.current.onAudioReady?.(audioBase64);
      } catch {
        // Keep the text reply even if TTS fails
        setMascot("idle");
      }
    },
    [setMascot]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);
      setIsProcessing(true);
      setStatusMessage("Generating answer...");
      setMascot("thinking");
      addMessage("user", text, undefined, false);

      const assistantId = makeId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      let fullAnswer = "";

      try {
        await streamChatMessage(
          {
            message: text,
            session_id: sessionId,
            tutor_mode: tutorModeRef.current,
            hint_level: hintLevelRef.current,
            learner_id: getLearnerId(),
          },
          {
            onToken: (token) => {
              fullAnswer += token;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                )
              );
            },
            onComplete: (meta) => {
              setSessionId(meta.session_id);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: meta.sources } : m
                )
              );
              optionsRef.current.onCues?.(
                meta.emotion as MascotEmotion | undefined,
                meta.gesture as MascotGesture | undefined
              );
            },
          }
        );
        setIsProcessing(false);
        await playAnswerAudio(fullAnswer);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(e instanceof Error ? e.message : "Failed to send message");
        setMascot("idle");
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    },
    [sessionId, addMessage, setMascot, playAnswerAudio]
  );

  const sendVoice = useCallback(
    async (audioBlob: Blob) => {
      if (!audioBlob.size) {
        setError("Recording was empty. Hold the mic for at least 1 second.");
        setStatusMessage(null);
        setMascot("idle");
        return;
      }

      setError(null);
      setIsProcessing(true);
      setStatusMessage("Transcribing...");
      setMascot("thinking");

      const placeholderId = makeId();
      setMessages((prev) => [
        ...prev,
        {
          id: placeholderId,
          role: "user",
          content: "Transcribing...",
          timestamp: new Date(),
          isVoice: true,
        },
      ]);

      try {
        setStatusMessage("Generating answer...");
        const res = await sendVoiceQuery(audioBlob, sessionId, {
          tutor_mode: tutorModeRef.current,
          learner_id: getLearnerId(),
        });
        setSessionId(res.session_id);

        setMessages((prev) => {
          const rest = prev.filter((m) => m.id !== placeholderId);
          return [
            ...rest,
            {
              id: makeId(),
              role: "user" as const,
              content: res.transcript || "(could not transcribe — try again)",
              timestamp: new Date(),
              isVoice: true,
            },
            {
              id: makeId(),
              role: "assistant" as const,
              content: res.answer,
              timestamp: new Date(),
              sources: res.sources,
            },
          ];
        });

        if (res.audio_base64) {
          setIsSpeaking(true);
          optionsRef.current.onSpeakingChange?.(true);
          setMascot("speaking");
          optionsRef.current.onCues?.(res.emotion, res.gesture);
          optionsRef.current.onAudioReady?.(res.audio_base64);
        } else {
          setMascot("idle");
        }
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        setError(e instanceof Error ? e.message : "Voice query failed");
        setMascot("idle");
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    },
    [sessionId, setMascot]
  );

  return {
    messages,
    sessionId,
    isProcessing,
    isSpeaking,
    statusMessage,
    error,
    tutorMode,
    setTutorMode,
    hintLevel,
    setHintLevel,
    sendText,
    sendVoice,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
  };
}
