"use client";

import React, { useEffect, useRef } from "react";

export type LyricLine = {
  text: string;
  startTime: number;
  endTime: number;
};

export type SyncedLyricsProps = {
  lyrics: LyricLine[];
  activeIndex: number;
  countdown?: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function findActiveLyricIndex(lyrics: LyricLine[], t: number) {
  let lo = 0;
  let hi = lyrics.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const l = lyrics[mid];
    if (t < l.startTime) {
      hi = mid - 1;
    } else if (t >= l.endTime) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  let idx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].startTime <= t) idx = i;
    else break;
  }
  return idx;
}

export const SyncedLyrics = React.memo(function SyncedLyrics({ lyrics, activeIndex, countdown = null }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex] && containerRef.current) {
      const container = containerRef.current;
      const el = itemRefs.current[activeIndex];
      
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      
      const containerCenter = cRect.left + cRect.width / 2;
      const elementCenter = eRect.left + eRect.width / 2;
      const delta = elementCenter - containerCenter;
      
      if (Math.abs(delta) > 12) {
        container.scrollBy({ left: delta, behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  if (countdown !== null) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-none border border-zinc-800 bg-zinc-900 p-4">
        <div
          key={countdown}
          className="animate-in zoom-in duration-300 text-6xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]"
        >
          {countdown}
        </div>
      </div>
    );
  }

  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-none border border-zinc-800 bg-zinc-900 p-4 text-zinc-500">
        <p className="text-sm font-sans tracking-widest">暂无歌词数据</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-row items-center overflow-x-auto overflow-y-hidden rounded-none border border-zinc-800 bg-zinc-900 scrollbar-hide snap-x snap-mandatory"
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
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;

          return (
            <div
              key={idx}
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
              className={cn(
                "transition-all duration-300 ease-out snap-center min-w-[20px] text-center",
                isActive
                  ? "scale-110 font-bold text-white text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  : isPast
                  ? "text-zinc-500 text-xl"
                  : "text-zinc-600 text-xl"
              )}
            >
              {lyric.text || "·"}
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.lyrics === next.lyrics &&
         prev.activeIndex === next.activeIndex &&
         prev.countdown === next.countdown;
});

export default SyncedLyrics;
