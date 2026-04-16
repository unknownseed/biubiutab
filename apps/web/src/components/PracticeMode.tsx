"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chord, Interval, Note } from "@tonaljs/tonal";
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

  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [transpose, setTranspose] = useState(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  
  useEffect(() => {
    loopARef.current = loopA;
    loopBRef.current = loopB;
  }, [loopA, loopB]);

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
      api.settings.display.resources.wordsFont.size = 0;
      // Force smaller top padding in layout if possible, though AlphaTab layout margins are mostly fixed.
      // We will handle the remaining whitespace with negative margin in CSS.
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
      
      const scrollContainer = containerRef.current; // The element with overflow-x-auto
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
          const cursor = containerRef.current!.querySelector('.at-cursor-beat') 
            || containerRef.current!.querySelector('.at-cursor-bar')
            || containerRef.current!.querySelector('rect[fill="rgba(255, 255, 255, 0.2)"]'); 
            
          if (cursor) {
            // Get the cursor position relative to the scroll container's internal content
            const cursorRect = cursor.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            
            // We calculate how much we need to shift the current scrollLeft to put the cursor in the center
            const offsetToCenter = (cursorRect.left - containerRect.left) - (containerRect.width / 2) + (cursorRect.width / 2);
            
            const targetX = scrollContainer.scrollLeft + offsetToCenter;
            
            if (Math.abs(offsetToCenter) > 10) {
              scrollContainer.scrollTo({ left: targetX, behavior: 'smooth' });
            }
          }
        });
      };

      // Provide a way to manually sync scroll externally
      // We attach it to the ref so the component can call it on seek
      (alphaTabApiRef.current as any)._syncScrollToCursor = syncScrollToCursor;

      // Allow forcing the cursor to jump manually when paused
      (alphaTabApiRef.current as any)._forceUpdateCursor = () => {
        if (!alphaTabApiRef.current) return;
        try {
          // In alphaTab, timePosition changes don't automatically trigger the renderer cursor update when paused.
          // tickPosition is automatically derived from timePosition by the api
          const tick = alphaTabApiRef.current.tickPosition;
          
          if (alphaTabApiRef.current.renderer) {
            // Internal method to force cursor to a tick
            alphaTabApiRef.current.renderer.updateCursor(tick);
          }
        } catch(e) {}
      };

      // Sync alphaTab engine position with our React state
      api.playerPositionChanged?.on?.((args: any) => {
        const sec = args.currentTime / 1000;
        setCurrentTime(sec);
        
        // Loop playback logic
        const lB = loopBRef.current;
        const lA = loopARef.current;
        if (lB !== null && lA !== null && sec >= lB && api.playerState === 1) {
          api.timePosition = lA * 1000;
          return;
        }
        
        // When seeking while paused, playedBeatChanged isn't fired reliably for scrolling.
        // We trigger it manually. But we debounce it slightly so rapid dragging doesn't jitter.
        if (!alphaTabApiRef.current?.isReadyForPlayback) return;
        const isCurrentlyPlaying = alphaTabApiRef.current.playerState === 1;
        if (!isCurrentlyPlaying) {
          // Use requestAnimationFrame instead of setTimeout to allow AlphaTab to render the cursor first,
          // then sync scroll
          requestAnimationFrame(() => syncScrollToCursor());
        }
      });

      // Add playedBeatChanged listener to force horizontal scroll centering during playback
      api.playedBeatChanged?.on?.((beat: any) => {
        if (!beat) return;
        syncScrollToCursor();
      });

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

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (alphaTabApiRef.current) {
      alphaTabApiRef.current.playbackSpeed = rate;
    }
  };

  const handleTransposeChange = (semitones: number) => {
    setTranspose(semitones);
  };

  const handleSeek = (timeSeconds: number) => {
    if (!alphaTabApiRef.current) return;
    alphaTabApiRef.current.timePosition = timeSeconds * 1000;
    setCurrentTime(timeSeconds);
    
    // When paused, AlphaTab does not always redraw the cursor for timePosition changes.
    // We explicitly trigger a tick to force cursor recalculation.
    if (alphaTabApiRef.current.playerState !== 1) {
      if ((alphaTabApiRef.current as any)._forceUpdateCursor) {
        (alphaTabApiRef.current as any)._forceUpdateCursor();
      }
    }
    
    // We try to sync scroll shortly after seeking to ensure alphaTab has updated the cursor
    let attempts = 5;
    const trySync = () => {
      setTimeout(() => {
        if (alphaTabApiRef.current && (alphaTabApiRef.current as any)._syncScrollToCursor) {
          (alphaTabApiRef.current as any)._syncScrollToCursor();
          
          const cursor = containerRef.current?.querySelector('.at-cursor-beat') 
            || containerRef.current?.querySelector('.at-cursor-bar');
          
          if (!cursor && attempts > 0) {
            attempts--;
            trySync();
          }
        }
      }, 50);
    };
    trySync();
  };

  // Group adjacent identical chords to simulate "measures" or longer blocks
  // Also apply transposition
  const chordBlocks = useMemo(() => {
    const rawChordBlocks: ChordBlock[] = practiceData?.chordBlocks?.map((b: any, i: number) => ({
      id: `chord-${i}`,
      chord: b.chord,
      startTime: b.startTime,
      endTime: b.endTime,
      section: b.section,
    })) || [];

    if (!rawChordBlocks.length) return [];
    
    // First, transpose if needed
    const transposed = rawChordBlocks.map(b => {
      if (transpose === 0 || b.chord === "N" || b.chord === "None") return b;
      try {
        const transposedName = Chord.transpose(b.chord, Interval.fromSemitones(transpose));
        return { ...b, chord: transposedName || b.chord };
      } catch {
        return b;
      }
    });

    // Then group consecutive identical chords
    const merged: (ChordBlock & { count: number })[] = [];
    let current = { ...transposed[0], count: 1 };
    
    for (let i = 1; i < transposed.length; i++) {
      const b = transposed[i];
      // Note: we can define identical as same chord + same section
      // If we merge across sections, the section label logic in ChordTimeline might look weird,
      // but typically we don't merge across sections.
      if (b.chord === current.chord && b.section === current.section) {
        current.endTime = b.endTime;
        current.count += 1;
      } else {
        merged.push(current);
        current = { ...b, count: 1 };
      }
    }
    merged.push(current);
    
    return merged;
  }, [practiceData?.chordBlocks, transpose]);

  // Calculate current key display
  const currentKeyDisplay = useMemo(() => {
    let originalKey = practiceData?.metadata?.key;
    if (!originalKey) {
      const firstValidChord = practiceData?.chordBlocks?.find((b: any) => b.chord && b.chord !== "N" && b.chord !== "None");
      originalKey = firstValidChord ? (Chord.get(firstValidChord.chord).tonic || "C") : "C";
    }
    try {
      const transposed = Note.transpose(originalKey, Interval.fromSemitones(transpose));
      return Note.simplify(transposed);
    } catch {
      return originalKey;
    }
  }, [practiceData, transpose]);

  const lyrics = practiceData?.lyrics || [];
  const songTitle = practiceData?.metadata?.title || practiceData?.title || "未知曲目";

  // Find current chord
  const currentChordBlock = chordBlocks.find((b) => currentTime >= b.startTime && currentTime < b.endTime) || chordBlocks[0];

  const handleLoopSet = (type: "A" | "B" | "clear") => {
    if (type === "clear") {
      setLoopA(null);
      setLoopB(null);
    } else if (type === "A") {
      // Snap A to the start of the current chord
      setLoopA(currentChordBlock?.startTime ?? currentTime);
      setLoopB(null); // reset B if we are re-setting A
    } else if (type === "B") {
      const targetB = currentChordBlock?.endTime ?? currentTime;
      // ensure B is after A
      if (loopA !== null && targetB <= loopA) {
        // If B is placed before or at A, swap them logically
        const oldAChord = chordBlocks.find(b => loopA >= b.startTime && loopA < b.endTime) || currentChordBlock;
        setLoopA(currentChordBlock?.startTime ?? currentTime);
        setLoopB(oldAChord?.endTime ?? loopA);
      } else {
        setLoopB(targetB);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-950 p-4 sm:p-6 text-zinc-50 shadow-xl">
      {playerError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {playerError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          </div>
          <div
            className="w-full overflow-hidden rounded-2xl bg-zinc-50"
            style={{ height: "140px" }}
          >
            <div
              ref={containerRef}
              className="h-full w-full overflow-x-auto overflow-y-hidden"
              style={{ marginTop: "-24px" }}
            />
          </div>
        </div>
        <SyncedLyrics lyrics={lyrics} currentTime={currentTime} />
      </div>

      <ChordTimeline
        blocks={chordBlocks}
        currentTime={currentTime}
        onSeek={(time) => handleSeek(time)}
        loopA={loopA}
        loopB={loopB}
      />

      <PlaybackControls
        isPlaying={isPlaying}
        isPlayerReady={isPlayerReady}
        isLoading={isInitializing}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        playbackRate={playbackRate}
        onPlaybackRateChange={handlePlaybackRateChange}
        transpose={transpose}
        onTransposeChange={handleTransposeChange}
        currentKeyDisplay={currentKeyDisplay}
        songTitle={songTitle}
        loopA={loopA}
        loopB={loopB}
        onLoopSet={handleLoopSet}
      />
    </div>
  );
}
