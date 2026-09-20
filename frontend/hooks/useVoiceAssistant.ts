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

const TEXT_TIMEOUT_MS = 180_000;
const VOICE_TIMEOUT_MS = 180_000;

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
  const abortRef = useRef<AbortController | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

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
    setSpeakingMessageId(null);
    optionsRef.current.onSpeakingChange?.(false);
    setMascot("idle");
  }, [setMascot]);

  const cancelTurn = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsProcessing(false);
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setStatusMessage(null);
    setMascot("idle");
    optionsRef.current.onSpeakingChange?.(false);
  }, [setMascot]);

  const playAnswerAudio = useCallback(
    async (
      answer: string,
      signal?: AbortSignal,
      messageId?: string,
      onReadyToSpeak?: () => void
    ) => {
      if (!answer.trim()) {
        setMascot("idle");
        return false;
      }
      try {
        setStatusMessage("Preparing voice...");
        const audioBase64 = await synthesizeSpeech(answer, signal);
        if (signal?.aborted) {
          setMascot("idle");
          onReadyToSpeak?.();
          return false;
        }
        if (!audioBase64) {
          setMascot("idle");
          onReadyToSpeak?.();
          return false;
        }
        onReadyToSpeak?.();
        if (messageId) setSpeakingMessageId(messageId);
        setIsSpeaking(true);
        optionsRef.current.onSpeakingChange?.(true);
        setMascot("speaking");
        optionsRef.current.onAudioReady?.(audioBase64);
        return true;
      } catch {
        setSpeakingMessageId(null);
        setMascot("idle");
        onReadyToSpeak?.();
        return false;
      }
    },
    [setMascot]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = window.setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);

      setError(null);
      setIsProcessing(true);
      setStatusMessage("Generating answer...");
      setMascot("thinking");
      addMessage("user", text, undefined, false);

      const assistantId = makeId();
      let fullAnswer = "";
      let sources: string[] | undefined;

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
            },
            onComplete: (meta) => {
              setSessionId(meta.session_id);
              sources = meta.sources;
              optionsRef.current.onCues?.(
                meta.emotion as MascotEmotion | undefined,
                meta.gesture as MascotGesture | undefined
              );
            },
          },
          controller.signal
        );
        if (!fullAnswer.trim()) {
          const fallback = "I couldn't generate an answer in time. Try a shorter question.";
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: fallback,
              timestamp: new Date(),
            },
          ]);
          setMascot("idle");
          return;
        }
        window.clearTimeout(timer);
        await playAnswerAudio(fullAnswer, controller.signal, assistantId, () => {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: fullAnswer,
              timestamp: new Date(),
              sources,
            },
          ]);
        });
      } catch (e) {
        const aborted = controller.signal.aborted;
        const message =
          aborted
            ? "That took too long on this machine. Try a shorter question."
            : e instanceof Error
              ? e.message
              : "Failed to send message";
        setMessages((prev) => {
          if (fullAnswer.trim()) {
            return [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: fullAnswer,
                timestamp: new Date(),
                sources,
              },
            ];
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: message,
              timestamp: new Date(),
            },
          ];
        });
        if (!aborted) setError(message);
        setMascot("idle");
      } finally {
        window.clearTimeout(timer);
        if (abortRef.current === controller) abortRef.current = null;
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

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = window.setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

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
        const res = await sendVoiceQuery(
          audioBlob,
          sessionId,
          {
            tutor_mode: tutorModeRef.current,
            learner_id: getLearnerId(),
          },
          controller.signal
        );
        setSessionId(res.session_id);

        const assistantId = makeId();
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
              id: assistantId,
              role: "assistant" as const,
              content: res.answer,
              timestamp: new Date(),
              sources: res.sources,
            },
          ];
        });

        if (res.audio_base64) {
          setSpeakingMessageId(assistantId);
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
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Voice query failed");
        }
        setMascot("idle");
      } finally {
        window.clearTimeout(timer);
        if (abortRef.current === controller) abortRef.current = null;
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
    speakingMessageId,
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
    cancelTurn,
    playAnswerAudio,
  };
}
