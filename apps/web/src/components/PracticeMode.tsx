"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chord, Interval, Note } from "@tonaljs/tonal";
import ChordTimeline, { type ChordBlock, findActiveIndex } from "./ChordTimeline";
import SyncedLyrics, { findActiveLyricIndex } from "./SyncedLyrics";
import LargeChordDiagram from "./LargeChordDiagram";
import PlaybackControls from "./PlaybackControls";
import { GuitarSampler } from "./GuitarSampler";

// 【功能开关】
// 设置为 true 即可开启 Tone.js 原声吉他采样器引擎（需要准备音频切片）
// 设置为 false 则继续使用 AlphaTab 内置的 SF2 合成器
const USE_TONE_JS = false;

declare global {
  interface Window {
    alphaTab?: any;
  }
}

const ALPHATAB_SCRIPT_URL = "/alphatab/alphaTab.js";
const ALPHATAB_FONT_DIR = "/alphatab/font/";
const ALPHATAB_SOUNDFONT_URL = "/alphatab/soundfont/TimGM6mb.sf2";

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
  songTitle?: string;
};

export default function PracticeMode({ practiceData, gp5Data, songTitle }: PracticeModeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const alphaTabApiRef = useRef<any>(null);
  const guitarSamplerRef = useRef<GuitarSampler | null>(null);
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
  const [bpm, setBpm] = useState<number | undefined>(practiceData?.metadata?.tempo);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const playTick = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.005);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  
  useEffect(() => {
    loopARef.current = loopA;
    loopBRef.current = loopB;
  }, [loopA, loopB]);

  const destroyEngine = () => {
    if (USE_TONE_JS) guitarSamplerRef.current?.stopAll();
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
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
          // 如果启用 Tone.js，则关闭 AlphaTab 自身的发声器，仅派发 MIDI 事件
          playerMode: USE_TONE_JS ? mod.PlayerMode.MidiEventsOnly : mod.PlayerMode.EnabledSynthesizer,
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

      if (USE_TONE_JS && !guitarSamplerRef.current) {
        guitarSamplerRef.current = new GuitarSampler();
        
        // 拦截 AlphaTab 抛出的真实按弦发声事件
        api.playedBeatChanged?.on?.((beat: any) => {
          if (!beat || !guitarSamplerRef.current?.isReady) return;
          
          // 遍历小节里的所有真实弹奏的音符
          beat.notes.forEach((note: any) => {
            // Note: 这里的力度 0-15，转换到 0-1，或者直接默认 0.8
            const vel = note.dynamics ? note.dynamics / 15 : 0.8;
            guitarSamplerRef.current?.playNote(note.realValue, vel);
          });
        });
        
        // （可选）如果需要精准的消音，也可以监听休止符事件等。
      }

      api.scoreLoaded?.on?.((score: any) => {
        score.tracks.forEach((t: any) => {
          if (t.playbackInfo) {
            t.playbackInfo.program = 25; // 25 = Steel string guitar in GM
          }
        });
      });

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
        if (!USE_TONE_JS) {
          setPlayerError("正在加载高质量 GM 吉他音源 (约5.8MB)...");
          const res = await fetch(ALPHATAB_SOUNDFONT_URL, { cache: "force-cache" });
          if (!res.ok) throw new Error(`soundfont http ${res.status}`);
          const buf = await res.arrayBuffer();
          api.loadSoundFont(buf, false);
          setPlayerError(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPlayerError("音源加载失败，将使用无声模式：" + msg);
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
    if (USE_TONE_JS) {
      guitarSamplerRef.current?.startAudioContext();
    }

    if (!alphaTabApiRef.current) {
      ensureEngine(true);
      return;
    }
    if (!alphaTabApiRef.current.isReadyForPlayback) {
      ensureEngine(true);
      return;
    }

    if (isPlaying) {
      if (USE_TONE_JS) guitarSamplerRef.current?.stopAll();
      alphaTabApiRef.current.playPause();
    } else if (countdown !== null) {
      // Cancel countdown if they click pause while counting down
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    } else {
      // Start countdown
      const bpm = practiceData?.metadata?.tempo || 120;
      const safeBpm = Math.max(60, Math.min(240, bpm));
      // Give ~1 beat per count, adjusted by playbackRate so it matches the real feel
      const intervalMs = (60000 / safeBpm) / playbackRate;

      let count = 4;
      setCountdown(count);
      playTick();

      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
          playTick();
        } else {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdown(null);
          if (alphaTabApiRef.current) {
            alphaTabApiRef.current.playPause();
          }
        }
      }, intervalMs);
    }
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

  const handleSeek = (timeSeconds: number, block?: any) => {
    if (USE_TONE_JS) guitarSamplerRef.current?.stopAll();
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
    }
    if (!alphaTabApiRef.current) return;
    
    // Always seek to the exact start time of the block if it's provided, otherwise fallback to the exact time
    const targetTime = block?.startTime ?? timeSeconds;
    
    alphaTabApiRef.current.timePosition = targetTime * 1000;
    setCurrentTime(targetTime);
    
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
      startBeat: b.startBeat,
      endBeat: b.endBeat,
      isBarStart: b.isBarStart,
      isBarEnd: b.isBarEnd,
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

    // IMPORTANT: We no longer group consecutive identical chords into a single wide block.
    // Instead, we keep them as individual 1-beat blocks to make it look like Chordify.
    // The ChordTimeline component will handle not rendering the chord name for repeated chords.
    return transposed.map(b => ({ ...b, count: 1 }));
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
  const displayTitle = songTitle || practiceData?.metadata?.title || practiceData?.title || "未知曲目";

  const activeChordIndex = useMemo(() => {
    if (!chordBlocks?.length) return -1;
    return findActiveIndex(chordBlocks, currentTime);
  }, [chordBlocks, currentTime]);

  const activeLyricIndex = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;
    return findActiveLyricIndex(lyrics, currentTime);
  }, [lyrics, currentTime]);

  // Find current chord
  const currentChordBlock = chordBlocks[activeChordIndex] || chordBlocks[0];

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
    <div className="flex flex-col gap-4 rounded-none bg-zinc-950 p-4 sm:p-6 text-zinc-50 shadow-xl">
      {playerError ? (
        <div className="rounded-none border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-sans tracking-wide text-red-100">
          {playerError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          </div>
          <div
            className="w-full rounded-none bg-zinc-50 overflow-hidden border border-zinc-800"
            style={{ height: "160px" }}
          >
            <div
              ref={containerRef}
              className="h-full w-full overflow-x-auto overflow-y-hidden"
              style={{ 
                transform: "translateY(-16px)",
                height: "calc(100% + 16px)"
              }}
            />
          </div>
        </div>
        <SyncedLyrics lyrics={lyrics} activeIndex={activeLyricIndex} countdown={countdown} />
      </div>

      <ChordTimeline
        blocks={chordBlocks}
        activeIndex={activeChordIndex}
        onSeek={(time, block) => handleSeek(time, block)}
        loopA={loopA}
        loopB={loopB}
      />

        <PlaybackControls
        isPlaying={isPlaying || countdown !== null}
        isPlayerReady={isPlayerReady}
        isLoading={isInitializing}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={(t) => handleSeek(t)}
        playbackRate={playbackRate}
        onPlaybackRateChange={handlePlaybackRateChange}
        transpose={transpose}
        onTransposeChange={handleTransposeChange}
        currentKeyDisplay={currentKeyDisplay}
        songTitle={displayTitle}
        loopA={loopA}
        loopB={loopB}
        onLoopSet={handleLoopSet}
        bpm={bpm}
      />
    </div>
  );
}
