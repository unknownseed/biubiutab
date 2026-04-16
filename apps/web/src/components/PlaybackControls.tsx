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
}: PlaybackControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

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
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-400 tabular-nums tracking-wider">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div
        ref={progressRef}
        className="group relative h-4 w-full cursor-pointer touch-none py-1"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Background track */}
        <div className="absolute top-1.5 h-1.5 w-full rounded-full bg-zinc-800" />
        
        {/* Filled track */}
        <div
          className="absolute top-1.5 h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-[width] duration-75 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Playhead handle */}
        <div
          className="absolute top-1/2 -mt-2.5 h-5 w-5 -ml-2.5 rounded-full border-2 border-white bg-yellow-400 shadow-md transition-[left,transform] duration-75 ease-linear group-hover:scale-110 group-active:scale-95"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, currentTime - 5))}
          className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white active:scale-95"
          aria-label="Rewind 5 seconds"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 19 2 12 11 5 11 19"></polygon>
            <polygon points="22 19 13 12 22 5 22 19"></polygon>
          </svg>
        </button>

        <button
          type="button"
          onClick={onPlayPause}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-zinc-950 shadow-lg transition active:scale-95 ${
            isPlayerReady && !isLoading
              ? "bg-gradient-to-tr from-yellow-500 to-yellow-300 shadow-yellow-500/20 hover:scale-105 hover:shadow-yellow-500/40 cursor-pointer"
              : "bg-zinc-800 text-zinc-500 shadow-none cursor-pointer"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <svg className="h-6 w-6 animate-spin text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 19 22 12 13 5 13 19"></polygon>
            <polygon points="2 19 11 12 2 5 2 19"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}
