"use client";

import React, { useRef, useState } from "react";

export type PlaybackControlsProps = {
  isPlaying: boolean;
  isPlayerReady?: boolean;
  isLoading?: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (timeSeconds: number) => void;
  audioSource?: "midi" | "original" | "no_vocals";
  onAudioSourceChange?: (source: "midi" | "original" | "no_vocals") => void;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  transpose?: number;
  onTransposeChange?: (semitones: number) => void;
  currentKeyDisplay?: string;
  songTitle?: string;
  loopA?: number | null;
  loopB?: number | null;
  onLoopSet?: (type: "A" | "B" | "clear") => void;
  bpm?: number;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export const PlaybackControls = React.memo(function PlaybackControls({
  isPlaying,
  isPlayerReady = true,
  isLoading = false,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  audioSource = "midi",
  onAudioSourceChange,
  playbackRate = 1.0,
  onPlaybackRateChange,
  transpose = 0,
  onTransposeChange,
  currentKeyDisplay = "C",
  songTitle = "未知曲目",
  loopA = null,
  loopB = null,
  onLoopSet,
  bpm,
}: PlaybackControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const loopAPercent = duration > 0 && loopA !== null ? Math.min(100, Math.max(0, (loopA / duration) * 100)) : null;
  const loopBPercent = duration > 0 && loopB !== null ? Math.min(100, Math.max(0, (loopB / duration) * 100)) : null;

  const updateProgress = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    const percent = x / rect.width;
    const newTime = percent * duration;
    setDragTime(newTime);
    return newTime;
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-paper-300 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-serif tracking-widest text-ink-900 truncate">{songTitle}</div>
          {bpm ? <div className="mt-0.5 text-xs text-ink-700/60">{Math.round(bpm * playbackRate)} BPM</div> : null}
        </div>
        <div className="flex items-center gap-2">
          {onAudioSourceChange ? (
            <div className="flex items-center gap-1 rounded-lg border border-paper-300 bg-paper-50 p-1">
              <button
                type="button"
                onClick={() => onAudioSourceChange("midi")}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  audioSource === "midi" ? "bg-wood-400 text-ink-950" : "text-ink-700/70 hover:bg-paper-200"
                }`}
              >
                伴奏
              </button>
              <button
                type="button"
                onClick={() => onAudioSourceChange("original")}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  audioSource === "original" ? "bg-wood-400 text-ink-950" : "text-ink-700/70 hover:bg-paper-200"
                }`}
              >
                原曲
              </button>
              <button
                type="button"
                onClick={() => onAudioSourceChange("no_vocals")}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  audioSource === "no_vocals" ? "bg-wood-400 text-ink-950" : "text-ink-700/70 hover:bg-paper-200"
                }`}
              >
                卡拉OK
              </button>
            </div>
          ) : null}
          {onPlaybackRateChange ? (
            <div className="flex items-center gap-1 rounded-lg border border-paper-300 bg-paper-50 p-1">
              {[0.5, 0.75, 1.0, 1.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onPlaybackRateChange(rate)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md ${
                    playbackRate === rate ? "bg-wood-400 text-ink-950" : "text-ink-700/70 hover:bg-paper-200"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          ) : null}

          {onTransposeChange ? (
            <div className="flex items-center gap-2 rounded-lg border border-paper-300 bg-paper-50 p-1">
              <button type="button" onClick={() => onTransposeChange(transpose - 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-ink-700 hover:bg-paper-200">
                -
              </button>
              <div className="text-xs font-semibold text-ink-800 w-12 text-center font-serif tracking-wider">{currentKeyDisplay}</div>
              <button type="button" onClick={() => onTransposeChange(transpose + 1)} className="flex h-6 w-6 items-center justify-center rounded-md text-ink-700 hover:bg-paper-200">
                +
              </button>
            </div>
          ) : null}

          {onLoopSet ? (
            <button
              type="button"
              onClick={() => onLoopSet(loopA === null ? "A" : loopB === null ? "B" : "clear")}
              className="rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-xs font-semibold text-ink-900 hover:bg-paper-200"
            >
              {loopA !== null && loopB !== null ? "清除循环" : loopA !== null ? "设置循环 B" : "设置循环 A"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            className="rounded-full p-2 text-ink-700/70 transition hover:bg-paper-200 active:scale-95"
            aria-label="Rewind 5 seconds"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 19 2 12 11 5 11 19"></polygon>
              <polygon points="22 19 13 12 22 5 22 19"></polygon>
            </svg>
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition active:scale-95 flex-shrink-0 ${
              isPlayerReady && !isLoading
                ? "bg-wood-400 hover:bg-wood-500 text-ink-950"
                : "bg-paper-200 text-ink-700/60"
            }`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <svg className="h-5 w-5 animate-spin text-ink-700/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
            className="rounded-full p-2 text-ink-700/70 transition hover:bg-paper-200 active:scale-95"
            aria-label="Fast forward 5 seconds"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 19 22 12 13 5 13 19"></polygon>
              <polygon points="2 19 11 12 2 5 2 19"></polygon>
            </svg>
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs font-medium text-ink-700/60 tabular-nums tracking-wider w-10 text-right">{formatTime(displayTime)}</span>
          <div
            ref={progressRef}
            className="group relative h-4 flex-1 cursor-pointer touch-none py-1"
            onPointerDown={(e) => {
              setIsDragging(true);
              updateProgress(e);
            }}
            onPointerMove={(e) => {
              if (isDragging) updateProgress(e);
            }}
            onPointerUp={(e) => {
              if (!isDragging) return;
              setIsDragging(false);
              const newTime = updateProgress(e);
              if (newTime !== undefined) onSeek(newTime);
            }}
          >
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-paper-200" />
            <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-wood-400" style={{ width: `${progressPercent}%` }} />
            {loopAPercent !== null ? <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-emerald-500" style={{ left: `${loopAPercent}%` }} /> : null}
            {loopBPercent !== null ? <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-emerald-500" style={{ left: `${loopBPercent}%` }} /> : null}
          </div>
          <span className="text-xs font-medium text-ink-700/60 tabular-nums tracking-wider w-10">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
});

export default PlaybackControls;
