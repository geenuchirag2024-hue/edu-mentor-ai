"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export interface AudioPlayerHandle {
  play: (base64: string) => void;
  stop: () => void;
  isPlaying: () => boolean;
}

interface AudioPlayerProps {
  /** Fired when playback finishes or is stopped / errors. */
  onEnded?: () => void;
  /**
   * Real-time amplitude (0–1) while audio plays — used for lip-sync.
   * Called from requestAnimationFrame; keep the handler light.
   */
  onAudioLevel?: (level: number) => void;
}

/**
 * Hidden HTMLAudioElement wrapper with optional Web Audio analysis.
 * Does not change any backend APIs — only exposes amplitude for the mascot.
 */
const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ onEnded, onAudioLevel }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const rafRef = useRef<number | null>(null);
    const dataRef = useRef<Uint8Array | null>(null);
    const onAudioLevelRef = useRef(onAudioLevel);
    onAudioLevelRef.current = onAudioLevel;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    /** Attach AnalyserNode once per media element (MediaElementSource can only be created once). */
    const ensureAnalyser = () => {
      const el = audioRef.current;
      if (!el || !onAudioLevelRef.current) return;

      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      }

      const ctx = ctxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      if (!sourceRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        const source = ctx.createMediaElementSource(el);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        sourceRef.current = source;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    };

    /** Sample RMS-like energy from the analyser each animation frame. */
    const startLevelLoop = () => {
      if (rafRef.current != null) return;

      const tick = () => {
        const analyser = analyserRef.current;
        const data = dataRef.current;
        if (analyser && data && onAudioLevelRef.current) {
          // time-domain samples give a smoother mouth envelope than raw bins
          // Cast keeps TS happy across DOM lib variants for getByteTimeDomainData
          analyser.getByteTimeDomainData(data as never);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          // Soft curve so quiet speech still moves the mouth a bit
          const level = Math.min(1, Math.pow(rms * 2.8, 0.7));
          onAudioLevelRef.current(level);
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    const stopLevelLoop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      onAudioLevelRef.current?.(0);
    };

    const handleEnded = () => {
      stopLevelLoop();
      onEndedRef.current?.();
    };

    useImperativeHandle(ref, () => ({
      play(base64: string) {
        if (!audioRef.current) return;
        const el = audioRef.current;
        stopLevelLoop();
        el.src = `data:audio/wav;base64,${base64}`;
        el.load();
        ensureAnalyser();

        const attempt = el.play();
        if (attempt) {
          attempt
            .then(() => startLevelLoop())
            .catch(() => {
              // Browser autoplay block — retry once after a short delay
              setTimeout(() => {
                el.play()
                  .then(() => startLevelLoop())
                  .catch(() => handleEnded());
              }, 100);
            });
        }
      },
      stop() {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        handleEnded();
      },
      isPlaying() {
        return audioRef.current ? !audioRef.current.paused : false;
      },
    }));

    return (
      <audio
        ref={audioRef}
        className="hidden"
        crossOrigin="anonymous"
        onEnded={handleEnded}
        onError={handleEnded}
      />
    );
  }
);

export default AudioPlayer;
