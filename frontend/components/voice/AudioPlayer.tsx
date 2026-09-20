"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface AudioPlayerHandle {
  play: (base64: string) => void;
  stop: () => void;
  isPlaying: () => boolean;
}

interface AudioPlayerProps {
  onEnded?: () => void;
  onAudioLevel?: (level: number) => void;
  onProgress?: (current: number, duration: number) => void;
}

    const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ onEnded, onAudioLevel, onProgress }, ref) {
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
    const onProgressRef = useRef(onProgress);
    onProgressRef.current = onProgress;

    const ensureAnalyser = () => {
      const el = audioRef.current;
      if (!el || !onAudioLevelRef.current) return;

      if (!ctxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      }

      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();

      if (!sourceRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.35;
        const source = ctx.createMediaElementSource(el);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        sourceRef.current = source;
        // Time-domain buffer must match fftSize (not frequencyBinCount).
        dataRef.current = new Uint8Array(analyser.fftSize);
      }
    };

    const startLevelLoop = () => {
      if (rafRef.current != null) return;

      const tick = () => {
        const analyser = analyserRef.current;
        const data = dataRef.current;
        if (analyser && data && onAudioLevelRef.current) {
          analyser.getByteTimeDomainData(data as never);
          let sum = 0;
          let peak = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
            const a = Math.abs(v);
            if (a > peak) peak = a;
          }
          const rms = Math.sqrt(sum / data.length);
          // Mix RMS + peak so TTS consonants still drive the mouth.
          const energy = Math.max(rms * 1.55, peak * 0.9);
          const gated =
            energy < 0.012 ? 0 : Math.min(1, Math.pow(energy * 11.5, 0.52));
          onAudioLevelRef.current(gated);
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

    const emitProgress = () => {
      const el = audioRef.current;
      if (!el) return;
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      onProgressRef.current?.(el.currentTime, duration);
    };

    const handleEnded = () => {
      stopLevelLoop();
      const el = audioRef.current;
      const duration = el && Number.isFinite(el.duration) ? el.duration : 1;
      onProgressRef.current?.(duration, duration);
      onEndedRef.current?.();
    };

    useEffect(() => {
      return () => {
        stopLevelLoop();
        if (ctxRef.current && ctxRef.current.state !== "closed") {
          void ctxRef.current.close();
        }
        ctxRef.current = null;
        sourceRef.current = null;
        analyserRef.current = null;
      };
    }, []);

    useImperativeHandle(ref, () => ({
      play(base64: string) {
        if (!audioRef.current) return;
        const el = audioRef.current;
        stopLevelLoop();
        el.src = `data:audio/wav;base64,${base64}`;
        el.load();
        onProgressRef.current?.(0, 0);
        ensureAnalyser();

        const attempt = el.play();
        if (attempt) {
          attempt
            .then(() => startLevelLoop())
            .catch(() => {
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
        onTimeUpdate={emitProgress}
        onLoadedMetadata={emitProgress}
      />
    );
  }
);

export default AudioPlayer;
