"use client";

import React, { useEffect, useRef } from "react";

export type LyricLine = {
  text: string;
  startTime: number;
  endTime: number;
};

export type SyncedLyricsProps = {
  lyrics: LyricLine[];
  currentTime: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SyncedLyrics({ lyrics, currentTime }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-zinc-500">
        <p>暂无歌词数据</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-64 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-6 scrollbar-hide"
      style={{
        maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
      }}
    >
      <div className="flex flex-col gap-4 py-20 text-center">
        {lyrics.map((lyric, idx) => {
          const isActive = currentTime >= lyric.startTime && currentTime <= lyric.endTime;
          const isPast = currentTime > lyric.endTime;

          return (
            <div
              key={idx}
              ref={isActive ? activeLineRef : null}
              className={cn(
                "transition-all duration-300 ease-out",
                isActive
                  ? "scale-110 font-bold text-white text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  : isPast
                  ? "text-zinc-500 text-xl"
                  : "text-zinc-600 text-xl"
              )}
            >
              {lyric.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
