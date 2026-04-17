"use client";

import React, { useEffect, useMemo, useRef } from "react";

export type ChordBlock = {
  id?: string;
  chord: string; // e.g. "C", "Am", "F#m7"
  startTime: number; // seconds
  endTime: number; // seconds
  startBeat?: number;
  endBeat?: number;
  isBarStart?: boolean;
  isBarEnd?: boolean;
  section?: string; // e.g. "Intro" | "Verse" | "Chorus"
  count?: number; // Used for grouped blocks
  /** Loop settings */
  loopA?: number | null;
  loopB?: number | null;
};

export type ChordTimelineProps = {
  blocks: ChordBlock[];
  currentTime: number; // seconds
  duration?: number; // seconds (optional; only used for some UI decisions)
  onSeek?: (timeSeconds: number, block: ChordBlock, index: number) => void;

  /** UI tuning */
  baseBlockWidth?: number; // default 88
  centerActive?: boolean; // default true
  showSectionLabels?: boolean; // default true

  loopA?: number | null;
  loopB?: number | null;

  className?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Assumes blocks are sorted by startTime ascending (recommended).
 * If not sorted, behavior still works but active index search may be off.
 */
function findActiveIndex(blocks: ChordBlock[], t: number) {
  // Binary search for speed (O(log n))
  let lo = 0;
  let hi = blocks.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = blocks[mid];
    if (t < b.startTime) {
      hi = mid - 1;
    } else if (t >= b.endTime) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  // If not found (gaps), return the last block whose startTime <= t (or -1)
  // This keeps highlight stable even with tiny gaps.
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

export default function ChordTimeline(props: ChordTimelineProps) {
  const {
    blocks,
    currentTime,
    onSeek,
    baseBlockWidth = 56, // Slightly narrower for 1-beat blocks
    centerActive = true,
    showSectionLabels = true,
    loopA = null,
    loopB = null,
    className,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = useMemo(() => {
    if (!blocks?.length) return -1;
    return findActiveIndex(blocks, currentTime);
  }, [blocks, currentTime]);

  // Auto-center active block
  useEffect(() => {
    if (!centerActive) return;
    if (activeIndex < 0) return;

    const container = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!container || !el) return;

    // Center the active element smoothly within the container
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();

    const containerCenter = cRect.left + cRect.width / 2;
    const elementCenter = eRect.left + eRect.width / 2;
    const delta = elementCenter - containerCenter;

    // Avoid micro-scroll jitter: only scroll if far enough
    if (Math.abs(delta) > 12) {
      container.scrollBy({ left: delta, behavior: "smooth" });
    }
  }, [activeIndex, centerActive]);

  if (!blocks?.length) {
    return (
      <div
        className={cn(
          "rounded-xl bg-zinc-950/60 border border-white/10 p-4 text-zinc-300",
          className
        )}
      >
        No chord blocks.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={containerRef}
        className={cn(
          "w-full overflow-x-auto overflow-y-hidden",
          "rounded-xl border border-white/10 bg-zinc-950/60",
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
              isLooped = (bEnd > loopA) && (bStart < loopB);
            }

            let isLoopStart = false;
            if (loopA !== null && loopB === null) {
              isLoopStart = loopA >= b.startTime && loopA < b.endTime;
            }

            const sectionLabel =
              showSectionLabels && isNewSection(blocks, i) ? b.section : undefined;
              
            // Check if this chord is a repeat of the previous one in the same section
            const prevBlock = blocks[i - 1];
            const isRepeat = prevBlock && prevBlock.chord === b.chord && prevBlock.section === b.section;

            // Optional: Draw a thick line at the start of a bar
            // If the backend doesn't provide isBarStart, we try to guess based on index
            const isBarStart = b.isBarStart ?? (i % 4 === 0);

            return (
              <div key={b.id ?? `${b.chord}-${b.startTime}-${i}`} className="flex items-center">
                {/* Bar line indicator */}
                {isBarStart && i > 0 && (
                  <div className="h-[48px] w-1 bg-white/20 rounded-full mx-1" />
                )}
                
                <div className="flex flex-col">
                  {sectionLabel ? (
                    <div className="mb-1 px-2 text-[10px] font-semibold tracking-wide text-white/70">
                      {sectionLabel}
                    </div>
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
                      active && "scale-[1.10] opacity-100 border-yellow-300/50 chord-glow-pulse",
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
                      {!isRepeat && b.chord !== "N" && (
                        <div
                          className={cn(
                            "font-black leading-none drop-shadow text-center",
                            active ? "text-xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500" 
                              : isLooped || isLoopStart ? "text-lg text-emerald-300"
                              : "text-lg text-white"
                          )}
                        >
                          {b.chord}
                        </div>
                      )}
                      
                      {/* Show a small dot or dash if it's a repeat chord to indicate a beat */}
                      {isRepeat && (
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full opacity-50",
                          active ? "bg-yellow-300 opacity-100" : "bg-white"
                        )} />
                      )}
                    </div>

                    <div
                      className={cn(
                        "absolute bottom-1.5 h-[3px] rounded-full transition-all duration-150 z-10",
                        active ? "bg-yellow-300" : isLooped || isLoopStart ? "bg-emerald-400" : "bg-white/20"
                      )}
                      style={{ width: "24px" }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "--:--";
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
