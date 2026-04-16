"use client";

import React, { useEffect, useMemo, useRef } from "react";

export type ChordBlock = {
  id?: string;
  chord: string; // e.g. "C", "Am", "F#m7"
  startTime: number; // seconds
  endTime: number; // seconds
  section?: string; // e.g. "Intro" | "Verse" | "Chorus"
  count?: number; // Used for grouped blocks
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
    baseBlockWidth = 88,
    centerActive = true,
    showSectionLabels = true,
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
          "rounded-2xl border border-white/10 bg-zinc-950/60",
          "px-3 py-4",
          "snap-x snap-mandatory",
          "scroll-smooth"
        )}
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="flex items-stretch gap-2">
          {blocks.map((b, i) => {
            const count = b.count || 1;
            const width = baseBlockWidth * count;
            const active = i === activeIndex;

            const sectionLabel =
              showSectionLabels && isNewSection(blocks, i) ? b.section : undefined;

            return (
              <div key={b.id ?? `${b.chord}-${b.startTime}-${i}`} className="flex flex-col">
                {sectionLabel ? (
                  <div className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-white/70">
                    {sectionLabel}
                  </div>
                ) : (
                  <div className="mb-1 h-[16px]" />
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
                    "rounded-2xl",
                    "px-3 py-2",
                    "h-[84px]",
                    "flex flex-col items-center justify-center",
                    "text-white",
                    "bg-gradient-to-b",
                    sectionColor(b.section),
                    "border border-white/10",
                    "transition-[transform,opacity,box-shadow,border-color] duration-150 ease-out",
                    !active && "opacity-75 hover:opacity-95",
                    active && "scale-[1.10] opacity-100 border-yellow-300/50 chord-glow-pulse",
                    // When a block is very wide, center the text properly without weird stretching
                    "overflow-hidden"
                  )}
                  style={{ width }}
                  aria-label={`Seek to chord ${b.chord}`}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-2xl",
                      "bg-[radial-gradient(120px_60px_at_50%_0%,rgba(255,255,255,0.22),transparent_70%)]",
                      active ? "opacity-100" : "opacity-40"
                    )}
                  />

                  <div className="flex items-end justify-center gap-1 z-10">
                    <div
                      className={cn(
                        "font-black leading-none drop-shadow",
                        active ? "text-3xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500" : "text-2xl text-white"
                      )}
                    >
                      {b.chord}
                    </div>
                    {count > 1 && (
                      <div className="text-sm font-bold text-white/70 pb-[2px]">
                        ×{count}
                      </div>
                    )}
                  </div>

                  <div className="mt-1 text-[11px] font-medium text-white/80 z-10">
                    {formatTime(b.startTime)}
                  </div>

                  <div
                    className={cn(
                      "mt-2 h-[4px] rounded-full transition-all duration-150 z-10",
                      active ? "bg-yellow-300" : "bg-white/20"
                    )}
                    style={{ width: "40px" }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
        <div>Chords: {blocks.length}</div>
        <div className="tabular-nums">t = {currentTime.toFixed(2)}s</div>
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
