"use client";

import React, { useRef, useState, useEffect } from "react";

export type PlaybackControlsProps = {
  isPlaying: boolean;
  isPlayerReady?: boolean;
  isLoading?: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (timeSeconds: number) => void;
  
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  
  transpose?: number;
  onTransposeChange?: (semitones: number) => void;
  
  loopA?: number | null;
  loopB?: number | null;
  onLoopSet?: (type: "A" | "B" | "clear") => void;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "00:00";
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function PlaybackControls({
  isPlaying,
  isPlayerReady = true,
  isLoading = false,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  playbackRate = 1.0,
  onPlaybackRateChange,
  transpose = 0,
  onTransposeChange,
  loopA = null,
  loopB = null,
  onLoopSet,
}: PlaybackControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;
  const loopAPercent = duration > 0 && loopA !== null ? (loopA / duration) * 100 : null;
  const loopBPercent = duration > 0 && loopB !== null ? (loopB / duration) * 100 : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateProgress(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateProgress(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      const newTime = updateProgress(e);
      if (newTime !== undefined) {
        onSeek(newTime);
      }
    }
  };

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
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 px-6 py-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-800/50 p-1">
            {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => onPlaybackRateChange?.(rate)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                  playbackRate === rate
                    ? "bg-yellow-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 p-1">
            <button
              onClick={() => onTransposeChange?.(transpose - 1)}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-white"
            >
              -
            </button>
            <div className="text-xs font-semibold text-zinc-300 w-12 text-center">
              {transpose > 0 ? `+${transpose}` : transpose}
            </div>
            <button
              onClick={() => onTransposeChange?.(transpose + 1)}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700 hover:text-white"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 p-1">
          <button
            onClick={() => onLoopSet?.(loopA === null ? "A" : loopB === null ? "B" : "clear")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              loopA !== null && loopB !== null
                ? "bg-emerald-500 text-zinc-950"
                : loopA !== null
                ? "bg-emerald-500/30 text-emerald-300"
                : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            {loopA !== null && loopB !== null ? "Clear Loop" : loopA !== null ? "Set B" : "Set A"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, currentTime - 5))}
          className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white active:scale-95"
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
          className={`flex h-12 w-12 items-center justify-center rounded-full text-zinc-950 shadow-lg transition active:scale-95 flex-shrink-0 ${
            isPlayerReady && !isLoading
              ? "bg-gradient-to-tr from-yellow-500 to-yellow-300 shadow-yellow-500/20 hover:scale-105 hover:shadow-yellow-500/40 cursor-pointer"
              : "bg-zinc-800 text-zinc-500 shadow-none cursor-pointer"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <svg className="h-5 w-5 animate-spin text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white active:scale-95"
          aria-label="Fast forward 5 seconds"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 19 22 12 13 5 13 19"></polygon>
            <polygon points="2 19 11 12 2 5 2 19"></polygon>
          </svg>
        </button>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400 tabular-nums tracking-wider w-10 text-right">{formatTime(displayTime)}</span>
        
        <div
          ref={progressRef}
          className="group relative h-4 flex-1 cursor-pointer touch-none py-1"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="absolute top-1.5 h-1.5 w-full rounded-full bg-zinc-800" />
          
          {loopAPercent !== null && loopBPercent === null && (
            <div 
              className="absolute top-1.5 h-1.5 w-1 bg-emerald-500 rounded-full"
              style={{ left: `${loopAPercent}%` }}
            />
          )}
          
          {loopAPercent !== null && loopBPercent !== null && (
            <div 
              className="absolute top-1.5 h-1.5 bg-emerald-500/30 rounded-full"
              style={{ left: `${loopAPercent}%`, width: `${loopBPercent - loopAPercent}%` }}
            />
          )}
          
          <div
            className="absolute top-1.5 h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-[width] duration-75 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 -mt-2.5 h-5 w-5 -ml-2.5 rounded-full border-2 border-white bg-yellow-400 shadow-md transition-[left,transform] duration-75 ease-linear group-hover:scale-110 group-active:scale-95"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <span className="text-xs font-medium text-zinc-400 tabular-nums tracking-wider w-10">{formatTime(duration)}</span>
      </div>
      </div>
    </div>
  );
}
