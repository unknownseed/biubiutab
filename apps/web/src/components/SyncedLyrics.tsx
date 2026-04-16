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

function findActiveLyricIndex(lyrics: LyricLine[], t: number) {
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

export default function SyncedLyrics({ lyrics, currentTime }: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const activeIndex = React.useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;
    return findActiveLyricIndex(lyrics, currentTime);
  }, [lyrics, currentTime]);

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
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;

          return (
            <div
              key={idx}
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
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
