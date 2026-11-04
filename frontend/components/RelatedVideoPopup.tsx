"use client";

import React, { useEffect, useRef, useState } from "react";
import type { RelatedVideo } from "@/types/chat";

interface RelatedVideoPopupProps {
  video: RelatedVideo | null;
  isOpen: boolean;
  onClose: () => void;
  onReopen?: () => void;
}

export default function RelatedVideoPopup({
  video,
  isOpen,
  onClose,
  onReopen,
}: RelatedVideoPopupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // When a new video is passed in, reset error state and un-minimize
  useEffect(() => {
    if (video) {
      setHasError(false);
      setIsMinimized(false);
    }
  }, [video?.id]);

  // Pause video if modal is closed
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isMinimized) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMinimized, onClose]);

  if (!video) return null;

  const resolveMediaUrl = (url?: string | null): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    if (apiBase) return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
    return url;
  };

  const videoSrc = resolveMediaUrl(video.video_url);
  const posterSrc = resolveMediaUrl(video.thumbnail_url);

  // If dismissed or minimized, render floating re-open pill
  if (!isOpen || isMinimized) {
    return (
      <div className="fixed bottom-24 right-4 z-40 sm:bottom-20 sm:right-6 animate-fade-in">
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            if (!isOpen && onReopen) onReopen();
          }}
          className="group flex items-center gap-2.5 rounded-full border border-violet-200/80 bg-white/95 px-4 py-2.5 shadow-lg shadow-violet-500/10 backdrop-blur-md transition-all hover:scale-105 hover:border-violet-400 hover:shadow-violet-500/20 active:scale-95 text-slate-800"
          title={`Watch video: ${video.title}`}
          aria-label={`Open related video: ${video.title}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
              Related Video Guide
            </p>
            <p className="max-w-[180px] truncate text-xs font-semibold text-slate-800">
              {video.topic || video.title}
            </p>
          </div>
          <span className="ml-1 text-slate-400 group-hover:text-slate-600">↗</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Related Video Guide"
      className="fixed bottom-20 right-4 z-40 w-[min(94vw,420px)] sm:bottom-6 sm:right-6 animate-fade-in-up"
    >
      <div className="glass-panel overflow-hidden rounded-3xl border border-violet-200/80 bg-white/95 shadow-2xl shadow-violet-900/15 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/50">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  Related Video Guide
                </h3>
                <span className="rounded-full bg-violet-100 px-2 py-0.2 text-[9px] font-bold text-violet-700">
                  {video.subject || "Machine Learning"}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Visual Concept Explanation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Minimize / Dock Button */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              title="Minimize video card"
              aria-label="Minimize video card"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              title="Close video popup"
              aria-label="Close video popup"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-slate-900">
          {hasError ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <span className="text-2xl">⚠️</span>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                Video playback unavailable
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                The video file could not be streamed.
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              poster={posterSrc || undefined}
              controls
              playsInline
              preload="metadata"
              onError={() => setHasError(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="h-full w-full object-contain"
            >
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support HTML5 video streaming.
            </video>
          )}
        </div>

        {/* Content Details */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              {video.title}
            </h4>
            {video.duration_seconds && (
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {Math.round(video.duration_seconds)}s
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {video.description}
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Topic: <strong className="font-semibold text-slate-700">{video.topic}</strong></span>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="font-medium text-violet-600 hover:text-violet-800 transition"
            >
              Keep in background
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

