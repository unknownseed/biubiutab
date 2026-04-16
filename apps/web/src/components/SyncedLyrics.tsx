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
        inline: "center",
        block: "nearest",
      });
    }
  }, [currentTime]);

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 text-zinc-500">
        <p>暂无歌词数据</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-[200px] w-full flex-row items-center overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 bg-zinc-900/50 scrollbar-hide snap-x snap-mandatory"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
      }}
    >
      <div 
        className="flex flex-row items-center gap-12 w-max whitespace-nowrap"
        style={{ paddingLeft: "50%", paddingRight: "50%" }}
      >
        {lyrics.map((lyric, idx) => {
          const isActive = currentTime >= lyric.startTime && currentTime <= lyric.endTime;
          const isPast = currentTime > lyric.endTime;

          return (
            <div
              key={idx}
              ref={isActive ? activeLineRef : null}
              className={cn(
                "transition-all duration-300 ease-out snap-center",
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
