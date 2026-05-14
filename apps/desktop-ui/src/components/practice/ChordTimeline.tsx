"use client";

import React, { useEffect, useRef } from "react";

export type ChordBlock = {
  id?: string;
  chord: string;
  startTime: number;
  endTime: number;
  startBeat?: number;
  endBeat?: number;
  isBarStart?: boolean;
  isBarEnd?: boolean;
  section?: string;
  count?: number;
  loopA?: number | null;
  loopB?: number | null;
};

export type ChordTimelineProps = {
  blocks: ChordBlock[];
  activeIndex: number;
  duration?: number;
  onSeek?: (timeSeconds: number, block: ChordBlock, index: number) => void;
  baseBlockWidth?: number;
  centerActive?: boolean;
  showSectionLabels?: boolean;
  loopA?: number | null;
  loopB?: number | null;
  className?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function findActiveIndex(blocks: ChordBlock[], t: number) {
  let lo = 0;
  let hi = blocks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = blocks[mid];
    if (t < b.startTime) hi = mid - 1;
    else if (t >= b.endTime) lo = mid + 1;
    else return mid;
  }
  let idx = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].startTime <= t) idx = i;
    else break;
  }
  return idx;
}

function sectionColor(section?: string) {
  const s = (section || "").toLowerCase();
  if (s.includes("intro")) return "from-sky-600/90 to-sky-500/70";
  if (s.includes("verse")) return "from-emerald-600/90 to-emerald-500/70";
  if (s.includes("chorus")) return "from-amber-500/95 to-amber-400/75";
  if (s.includes("bridge")) return "from-violet-600/90 to-violet-500/70";
  if (s.includes("outro")) return "from-slate-600/90 to-slate-500/70";
  return "from-zinc-600/90 to-zinc-500/70";
}

function isNewSection(blocks: ChordBlock[], i: number) {
  if (i === 0) return true;
  const prev = blocks[i - 1]?.section || "";
  const curr = blocks[i]?.section || "";
  return prev !== curr;
}

export const ChordTimeline = React.memo(function ChordTimeline(props: ChordTimelineProps) {
  const {
    blocks,
    activeIndex,
    onSeek,
    baseBlockWidth = 56,
    centerActive = true,
    showSectionLabels = true,
    loopA = null,
    loopB = null,
    className,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!centerActive) return;
    if (activeIndex < 0) return;
    const container = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const containerCenter = cRect.left + cRect.width / 2;
    const elementCenter = eRect.left + eRect.width / 2;
    const delta = elementCenter - containerCenter;
    if (Math.abs(delta) > 12) container.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeIndex, centerActive]);

  if (!blocks?.length) {
    return <div className={cn("rounded-xl border border-paper-300 bg-paper-50 p-4 text-ink-700/70", className)}>No chord blocks.</div>;
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        className={cn(
          "w-full overflow-x-auto overflow-y-hidden",
          "rounded-xl border border-paper-300 bg-white",
          "px-3 py-3",
          "snap-x snap-mandatory",
          "scroll-smooth"
        )}
      >
        <div className="flex items-stretch gap-1">
          {blocks.map((b, i) => {
            const count = b.count || 1;
            const width = baseBlockWidth * count;
            const active = i === activeIndex;
            const isLoopActive = loopA !== null && loopB !== null;
            let isLooped = false;
            if (isLoopActive) {
              const bStart = b.startTime;
              const bEnd = b.endTime;
              isLooped = bEnd > loopA! && bStart < loopB!;
            }
            let isLoopStart = false;
            if (loopA !== null && loopB === null) isLoopStart = loopA >= b.startTime && loopA < b.endTime;
            const sectionLabel = showSectionLabels && isNewSection(blocks, i) ? b.section : undefined;
            const prevBlock = blocks[i - 1];
            const isRepeat = prevBlock && prevBlock.chord === b.chord && prevBlock.section === b.section;
            const isBarStart = b.isBarStart ?? (i % 4 === 0);

            return (
              <div key={b.id ?? `${b.chord}-${b.startTime}-${i}`} className="flex items-center">
                {isBarStart && i > 0 ? <div className="h-[48px] w-1 bg-ink-700/20 rounded-full mx-1" /> : null}
                <div className="flex flex-col">
                  {sectionLabel ? (
                    <div className="mb-1 px-2 text-[10px] font-semibold tracking-wide text-ink-700/70">{sectionLabel}</div>
                  ) : (
                    <div className="mb-1 h-[14px]" />
                  )}
                  <button
                    ref={(node) => {
                      itemRefs.current[i] = node;
                    }}
                    type="button"
                    onClick={() => onSeek?.(b.startTime, b, i)}
                    className={cn(
                      "snap-center",
                      "relative flex-shrink-0",
                      "rounded-lg",
                      "px-1 py-1",
                      "h-[60px]",
                      "flex flex-col items-center justify-center",
                      "text-white",
                      "bg-gradient-to-b",
                      sectionColor(b.section),
                      "border border-white/10",
                      "transition-[transform,opacity,box-shadow,border-color] duration-150 ease-out",
                      isLoopActive && !isLooped && !active && "opacity-30 grayscale",
                      !active && !(isLoopActive && !isLooped) && "opacity-75 hover:opacity-95",
                      active && "scale-[1.08] opacity-100 border-yellow-300/50",
                      isLooped && !active && "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
                      isLoopStart && !active && "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
                      "overflow-hidden"
                    )}
                    style={{ width }}
                    aria-label={`Seek to chord ${b.chord}`}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-lg",
                        "bg-[radial-gradient(120px_60px_at_50%_0%,rgba(255,255,255,0.22),transparent_70%)]",
                        active || isLooped || isLoopStart ? "opacity-100" : "opacity-40"
                      )}
                    />
                    <div className="flex items-center justify-center z-10 w-full h-full">
                      {!isRepeat && b.chord !== "N" ? (
                        <div
                          className={cn(
                            "font-black leading-none drop-shadow text-center",
                            active
                              ? "text-xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500"
                              : isLooped || isLoopStart
                              ? "text-lg text-emerald-300"
                              : "text-lg text-white"
                          )}
                        >
                          {b.chord}
                        </div>
                      ) : null}
                      {isRepeat ? <div className={cn("w-1.5 h-1.5 rounded-full opacity-50", active ? "bg-yellow-300 opacity-100" : "bg-white")} /> : null}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default ChordTimeline;

