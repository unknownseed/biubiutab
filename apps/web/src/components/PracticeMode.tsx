"use client";

import React, { useEffect, useRef, useState } from "react";
import ChordTimeline, { type ChordBlock } from "./ChordTimeline";
import SyncedLyrics from "./SyncedLyrics";
import LargeChordDiagram from "./LargeChordDiagram";
import PlaybackControls from "./PlaybackControls";

declare global {
  interface Window {
    alphaTab?: any;
  }
}

const ALPHATAB_SCRIPT_URL = "/alphatab/alphaTab.js";
const ALPHATAB_FONT_DIR = "/alphatab/font/";
const ALPHATAB_SOUNDFONT_URL = "/alphatab/soundfont/sonivox.sf2";

let alphaTabScriptPromise: Promise<void> | null = null;

function ensureAlphaTabScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("not in browser"));
  if (window.alphaTab) return Promise.resolve();
  if (alphaTabScriptPromise) return alphaTabScriptPromise;

  alphaTabScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${ALPHATAB_SCRIPT_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (window.alphaTab) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("alphatab script load failed")));
      return;
    }

    const s = document.createElement("script");
    s.src = ALPHATAB_SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("alphatab script load failed"));
    document.head.appendChild(s);
  });

  return alphaTabScriptPromise;
}

export type PracticeModeProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  practiceData: any;
  gp5Data: Uint8Array;
};

export default function PracticeMode({ practiceData, gp5Data }: PracticeModeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const alphaTabApiRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPlayRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const duration = practiceData?.metadata?.durationSec || 0;

  const destroyEngine = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (alphaTabApiRef.current) {
      try {
        alphaTabApiRef.current.destroy();
      } catch {}
      alphaTabApiRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
    initPromiseRef.current = null;
    pendingPlayRef.current = false;
    setIsPlaying(false);
    setIsPlayerReady(false);
    setIsInitializing(false);
  };

  const ensureEngine = (autoPlay: boolean) => {
    if (autoPlay) pendingPlayRef.current = true;
    if (alphaTabApiRef.current) return;
    if (initPromiseRef.current) return;

    initPromiseRef.current = (async () => {
      setPlayerError(null);
      setIsPlayerReady(false);
      setIsInitializing(true);
      await ensureAlphaTabScript();
      const mod = window.alphaTab;
      if (!containerRef.current) return;

      mod.Logger.logLevel = mod.LogLevel.Info;
      const scriptFile = new URL(ALPHATAB_SCRIPT_URL, window.location.href).toString();

      const api = new mod.AlphaTabApi(containerRef.current, {
        core: {
          engine: "svg",
          fontDirectory: ALPHATAB_FONT_DIR,
          scriptFile,
          useWorkers: false,
          logLevel: mod.LogLevel.Info,
        },
        player: {
          enablePlayer: true,
          playerMode: mod.PlayerMode.EnabledSynthesizer,
          soundFont: null,
          scrollElement: containerRef.current,
        },
        display: {
          scale: 1.0,
          layoutMode: mod.LayoutMode.Horizontal,
          staveProfile: mod.StaveProfile.Tab,
        },
        importer: {
          beatTextAsLyrics: false,
        },
        stylesheet: {
          globalDisplayChordDiagramsOnTop: false,
          globalDisplayChordDiagramsInScore: false,
        },
        notation: {
          rhythmMode: mod.TabRhythmMode.ShowWithBeams,
        },
      } as any);

      api.settings.display.resources.titleFont.size = 0;
      api.settings.display.resources.subTitleFont.size = 0;
      api.settings.notation.elements.set(mod.NotationElement.GuitarTuning, false);
      api.settings.notation.elements.set(mod.NotationElement.EffectChordNames, false);
      api.settings.notation.elements.set(mod.NotationElement.ChordDiagrams, false);
      api.settings.notation.elements.set((mod.NotationElement as any).EffectTempo, false);

      alphaTabApiRef.current = api;

      api.playerStateChanged?.on?.((args: any) => {
        setIsPlaying(args.state === 1);
      });

      api.playerReady?.on?.(() => {
        setIsPlayerReady(true);
        setIsInitializing(false);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          try {
            api.playPause();
          } catch {}
        }
      });

      // Optional: keep track of user manual scrolling to temporarily disable auto-scroll
      let isUserScrolling = false;
      let scrollTimeout: NodeJS.Timeout;
      
      const scrollContainer = containerRef.current.parentElement;
      if (scrollContainer) {
        scrollContainer.addEventListener('wheel', () => {
          isUserScrolling = true;
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => { isUserScrolling = false; }, 2000);
        }, { passive: true });
        scrollContainer.addEventListener('touchstart', () => {
          isUserScrolling = true;
          clearTimeout(scrollTimeout);
        }, { passive: true });
        scrollContainer.addEventListener('touchend', () => {
          scrollTimeout = setTimeout(() => { isUserScrolling = false; }, 2000);
        }, { passive: true });
      }

      // Helper function to handle center scrolling logic
      const syncScrollToCursor = () => {
        if (isUserScrolling || !containerRef.current || !scrollContainer) return;
        requestAnimationFrame(() => {
          // If we can't find .at-cursor-beat, we fallback to .at-cursor-bar
          const cursor = containerRef.current!.querySelector('.at-cursor-beat') || containerRef.current!.querySelector('.at-cursor-bar');
          if (cursor) {
            // Because AlphaTab SVG container might have internal padding or transforms,
            // calculating based on standard getBoundingClientRect is sometimes inaccurate 
            // if the scroll container is just generic. 
            // Let's use the explicit beat X position from the SVG if possible, or just the rects.
            const cursorRect = cursor.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollLeft = scrollContainer.scrollLeft;
            const targetX = scrollLeft + (cursorRect.left - containerRect.left) - (containerRect.width / 2) + (cursorRect.width / 2);
            
            // Allow a small threshold (10px) to prevent micro-jitters
            if (Math.abs(scrollLeft - targetX) > 10) {
              scrollContainer.scrollTo({ left: targetX, behavior: 'smooth' });
            }
          } else {
            // Fallback: If cursor isn't rendered yet but we know the timePosition, 
            // AlphaTab's tick position can sometimes be used if we calculate proportions, 
            // but relying on the cursor element is standard. 
            // We'll just wait for the next render.
          }
        });
      };

      // Sync alphaTab engine position with our React state
      api.playerPositionChanged?.on?.((args: any) => {
        setCurrentTime(args.currentTime / 1000);
        
        // During playback, we let `playedBeatChanged` handle the scroll to avoid duplicate calls.
        // However, when the user is dragging the progress bar (seek), the engine is paused
        // but `playerPositionChanged` fires rapidly. 
        if (!alphaTabApiRef.current?.isReadyForPlayback) return;
        
        // Since we can't reliably get `isPlaying` from useState here (stale closure),
        // we rely on the api's playerState. 1 = playing.
        const isCurrentlyPlaying = alphaTabApiRef.current.playerState === 1;
        if (!isCurrentlyPlaying) {
          syncScrollToCursor();
        }
      });

      // Add playedBeatChanged listener to force horizontal scroll centering during playback
      api.playedBeatChanged?.on?.((beat: any) => {
        if (!beat) return;
        syncScrollToCursor();
      });

      // Provide a way to manually sync scroll externally
      // We attach it to the ref so the component can call it on seek
      (alphaTabApiRef.current as any)._syncScrollToCursor = syncScrollToCursor;

      api.error?.on?.((e: any) => {
        const msg = e instanceof Error ? e.message : String(e);
        setPlayerError(msg || "播放器初始化失败");
        setIsInitializing(false);
      });

      pollRef.current = setInterval(() => {
        if (!alphaTabApiRef.current) return;
        if (api.isReadyForPlayback) {
          setIsPlayerReady(true);
          setIsInitializing(false);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            try {
              api.playPause();
            } catch {}
          }
        }
      }, 300);

      timeoutRef.current = setTimeout(() => {
        if (!alphaTabApiRef.current) return;
        if (!api.isReadyForPlayback) {
          setPlayerError("播放器初始化超时：请检查音源/Worker/浏览器音频策略");
          setIsInitializing(false);
        }
      }, 30000);

      try {
        const res = await fetch(ALPHATAB_SOUNDFONT_URL);
        if (!res.ok) throw new Error(`soundfont http ${res.status}`);
        const buf = await res.arrayBuffer();
        api.loadSoundFont(buf, false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPlayerError(msg || "音源加载失败");
        setIsInitializing(false);
      }

      try {
        let ok = false;
        try {
          ok = api.load(gp5Data);
        } catch {
          ok = false;
        }
        if (!ok) {
          for (let i = 1; i <= 4; i++) {
            try {
              if (api.load(gp5Data, [i])) {
                ok = true;
                break;
              }
            } catch {
              continue;
            }
          }
        }
        if (!ok) {
          throw new Error("谱例加载失败");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPlayerError(msg || "谱例加载失败");
        setIsInitializing(false);
      }
    })();
  };

  useEffect(() => {
    ensureEngine(false);
    return destroyEngine;
  }, []);

  const handlePlayPause = () => {
    if (!alphaTabApiRef.current) {
      ensureEngine(true);
      return;
    }
    if (!alphaTabApiRef.current.isReadyForPlayback) {
      ensureEngine(true);
      return;
    }
    alphaTabApiRef.current.playPause();
  };

  const handleSeek = (timeSeconds: number) => {
    if (!alphaTabApiRef.current) return;
    alphaTabApiRef.current.timePosition = timeSeconds * 1000;
    setCurrentTime(timeSeconds);
    
    // We try to sync scroll shortly after seeking to ensure alphaTab has updated the cursor
    let attempts = 3;
    const trySync = () => {
      setTimeout(() => {
        if (alphaTabApiRef.current && (alphaTabApiRef.current as any)._syncScrollToCursor) {
          (alphaTabApiRef.current as any)._syncScrollToCursor();
          
          const cursor = containerRef.current?.querySelector('.at-cursor-beat') || containerRef.current?.querySelector('.at-cursor-bar');
          if (!cursor && attempts > 0) {
            attempts--;
            trySync();
          }
        }
      }, 50);
    };
    trySync();
  };

  const chordBlocks: ChordBlock[] = practiceData?.chordBlocks?.map((b: any, i: number) => ({
    id: `chord-${i}`,
    chord: b.chord,
    startTime: b.startTime,
    endTime: b.endTime,
    section: b.section,
  })) || [];

  const lyrics = practiceData?.lyrics || [];

  // Find current chord
  const currentChordBlock = chordBlocks.find((b) => currentTime >= b.startTime && currentTime < b.endTime) || chordBlocks[0];

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-zinc-950 p-6 text-zinc-50 shadow-xl">
      {playerError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {playerError}
        </div>
      ) : null}

      <PlaybackControls
        isPlaying={isPlaying}
        isPlayerReady={isPlayerReady}
        isLoading={isInitializing}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
      />

      <ChordTimeline
        blocks={chordBlocks}
        currentTime={currentTime}
        onSeek={(time) => handleSeek(time)}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          <div
            className="w-full overflow-hidden rounded-2xl bg-zinc-50"
            style={{ height: "160px" }}
          >
            <div
              ref={containerRef}
              className="h-full w-full overflow-x-auto overflow-y-hidden"
            />
          </div>
        </div>
        <SyncedLyrics lyrics={lyrics} currentTime={currentTime} />
      </div>
    </div>
  );
}
