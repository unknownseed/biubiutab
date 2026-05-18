"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chord, Interval, Note } from "@tonaljs/tonal";
import ChordTimeline, { type ChordBlock, findActiveIndex } from "./ChordTimeline";
import SyncedLyrics from "./SyncedLyrics";
import LargeChordDiagram from "./LargeChordDiagram";
import PlaybackControls from "./PlaybackControls";
import { aiBaseUrl } from "../../lib/ai";

const ALPHATAB_FONT_DIR = "/alphatab/font/";
const ALPHATAB_SOUNDFONT_URL = "/alphatab/soundfont/sonivox.sf2";

export type PracticeModeProps = {
  practiceData: any;
  gp5Data: Uint8Array;
  songTitle?: string;
  jobId?: string;
  userId?: string | null;
  level?: number;
  onLevelChange?: (level: number) => void;
};

export default function PracticeMode({ practiceData, gp5Data, songTitle, jobId, userId, level = 4, onLevelChange }: PracticeModeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const alphaTabApiRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);
  const loadedGp5DataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const lastChordEndTime = useMemo(() => {
    const rawBlocks = practiceData?.chordBlocks;
    if (!rawBlocks || rawBlocks.length === 0) return duration;
    const lastBlock = rawBlocks[rawBlocks.length - 1];
    const safeBpm = bpm || 120;
    return (lastBlock.endBeat * 60) / safeBpm;
  }, [practiceData?.chordBlocks, duration, bpm]);

  const lastChordEndTimeRef = useRef(lastChordEndTime);
  useEffect(() => {
    lastChordEndTimeRef.current = lastChordEndTime;
  }, [lastChordEndTime]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tracks, setTracks] = useState<{name: string, index: number, isSolo: boolean}[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);

  const [audioSource, setAudioSource] = useState<"midi" | "original" | "no_vocals">("midi");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<"midi" | "original" | "no_vocals">("midi");
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioSourceRef.current = audioSource;
    if (alphaTabApiRef.current) {
      alphaTabApiRef.current.masterVolume = audioSource === "midi" ? 1 : 0;
    }
    if (audioRef.current) {
      if (audioSource === "midi") {
        audioRef.current.pause();
      } else {
        if (!jobId || !userId) return;
        let cancelled = false;
        const load = async () => {
          try {
            const url = `${aiBaseUrl()}/jobs/${jobId}/audio?type=${audioSource}`;
            const res = await fetch(url, { headers: { "x-user-id": userId } });
            if (!res.ok || cancelled) return;
            const buf = await res.arrayBuffer();
            if (cancelled) return;
            const blob = new Blob([buf], { type: res.headers.get("content-type") || "audio/mpeg" });
            const objUrl = URL.createObjectURL(blob);
            const prev = audioUrlRef.current;
            audioUrlRef.current = objUrl;
            if (prev) URL.revokeObjectURL(prev);
            audioRef.current!.src = objUrl;
            audioRef.current!.load();
            audioRef.current!.playbackRate = playbackRate;
            if (alphaTabApiRef.current) {
              const safeBpm = bpm || 120;
              const b0 = practiceData?.chordBlocks?.[0];
              const real0 = typeof b0?.startTime === "number" ? b0.startTime : 0;
              const ideal0 = b0 ? (Number(b0.startBeat || 0) * 60) / safeBpm : 0;
              const offset = Number.isFinite(real0 - ideal0) ? (real0 - ideal0) : 0;
              audioRef.current.currentTime = alphaTabApiRef.current.timePosition / 1000 + offset;
            }
            if (isPlaying) {
              audioRef.current.play().catch(() => {});
            }
          } catch {}
        };
        void load();
        return () => { cancelled = true; };
      }
    }
  }, [audioSource, jobId, userId, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

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
    } catch {}
  };

  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  useEffect(() => {
    loopARef.current = loopA;
    loopBRef.current = loopB;
  }, [loopA, loopB]);

  const destroyEngine = () => {
    isMountedRef.current = false;
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
    try {
      if (audioRef.current) audioRef.current.pause();
    } catch {}
    try {
      const u = audioUrlRef.current;
      if (u) URL.revokeObjectURL(u);
    } catch {}
    audioUrlRef.current = null;
    const api = alphaTabApiRef.current;
    alphaTabApiRef.current = null;
    if (api) {
      const doDestroy = () => {
        try { api.destroy(); } catch {}
      };
      const ric = (window as any).requestIdleCallback;
      if (typeof ric === "function") {
        ric(doDestroy, { timeout: 1000 });
      } else {
        setTimeout(doDestroy, 0);
      }
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
    initPromiseRef.current = null;
    pendingPlayRef.current = false;
  };

  const ensureEngine = (autoPlay: boolean) => {
    if (autoPlay) pendingPlayRef.current = true;
    if (alphaTabApiRef.current) return;
    if (initPromiseRef.current) return;

    initPromiseRef.current = (async () => {
      setPlayerError(null);
      setIsPlayerReady(false);
      setIsInitializing(true);

      const mod = await import("@coderline/alphatab");
      if (!isMountedRef.current) return;
      if (!containerRef.current) return;

      containerRef.current.innerHTML = "";

      mod.Logger.logLevel = mod.LogLevel.Info;

      const api = new mod.AlphaTabApi(containerRef.current, {
        core: {
          engine: "svg",
          fontDirectory: ALPHATAB_FONT_DIR,
          useWorkers: false,
          logLevel: mod.LogLevel.Info,
        },
        player: {
          enablePlayer: true,
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
          rhythmMode: mod.TabRhythmMode.ShowWithBars,
        },
      } as any);

      api.settings.display.resources.titleFont.size = 0;
      api.settings.display.resources.subTitleFont.size = 0;
      api.settings.display.resources.wordsFont.size = 0;
      api.settings.notation.elements.set(mod.NotationElement.GuitarTuning, false);
      api.settings.notation.elements.set(mod.NotationElement.EffectChordNames, false);
      api.settings.notation.elements.set(mod.NotationElement.ChordDiagrams, false);
      api.settings.notation.elements.set((mod.NotationElement as any).EffectTempo, false);
      api.settings.notation.elements.set((mod.NotationElement as any).EffectDynamics, false);

      alphaTabApiRef.current = api;

      api.scoreLoaded?.on?.((score: any) => {
        if (activeTrackIndexRef.current !== 0) {
          setActiveTrackIndex(0);
        }
        if (score.tracks && score.tracks.length > 0) {
          try {
            const t0 = score.tracks[0];
            const hasBeats = !!t0?.staves?.[0]?.bars?.[0]?.voices?.[0]?.beats;
            if (hasBeats) {
              api.renderTracks([t0]);
              try {
                api.changeTrackSolo(score.tracks, false);
                api.changeTrackSolo([t0], true);
              } catch {}
            }
          } catch {}
        }
        score.tracks.forEach((t: any) => {
          if (t.playbackInfo) {
            t.playbackInfo.program = 25;
          }
        });
        const scoreTracks = score.tracks.map((t: any, i: number) => ({
          name: t.name || `Track ${i + 1}`,
          index: i,
          isSolo: !!t.playbackInfo?.isSolo,
        }));
        setTracks(scoreTracks);
      });

      api.playerStateChanged?.on?.((args: any) => {
        setIsPlaying(args.state === 1);
        if (audioRef.current && audioSourceRef.current !== "midi") {
          if (args.state === 1) {
            const safeBpm = bpm || 120;
            const b0 = practiceData?.chordBlocks?.[0];
            const real0 = typeof b0?.startTime === "number" ? b0.startTime : 0;
            const ideal0 = b0 ? (Number(b0.startBeat || 0) * 60) / safeBpm : 0;
            const offset = Number.isFinite(real0 - ideal0) ? (real0 - ideal0) : 0;
            audioRef.current.currentTime = api.timePosition / 1000 + offset;
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }
      });

      api.playerReady?.on?.(() => {
        setIsPlayerReady(true);
        setIsInitializing(false);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          try {
            if (api.playerState === 0) {
              api.playPause();
            }
          } catch {}
        }
      });

      api.postRenderFinished?.on?.(() => {
        if (api.playerState !== 1) {
          if ((api as any)._forceUpdateCursor) {
            (api as any)._forceUpdateCursor();
          }
          if ((api as any)._syncScrollToCursor) {
            (api as any)._syncScrollToCursor();
          }
        }
      });

      let isUserScrolling = false;
      let scrollTimeout: ReturnType<typeof setTimeout>;
      const scrollContainer = containerRef.current;
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

      const syncScrollToCursor = () => {
        if (isUserScrolling || !containerRef.current || !scrollContainer) return;
        requestAnimationFrame(() => {
          if (!containerRef.current || !scrollContainer) return;
          const cursor = containerRef.current.querySelector('.at-cursor-beat')
            || containerRef.current.querySelector('.at-cursor-bar')
            || containerRef.current.querySelector('rect[fill="rgba(255, 255, 255, 0.2)"]');
          if (cursor) {
            const cursorRect = cursor.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const offsetToCenter = (cursorRect.left - containerRect.left) - (containerRect.width * 0.25) + (cursorRect.width / 2);
            const targetX = scrollContainer.scrollLeft + offsetToCenter;
            if (Math.abs(offsetToCenter) > 10) {
              scrollContainer.scrollTo({ left: targetX, behavior: 'smooth' });
            }
          }
        });
      };

      (api as any)._syncScrollToCursor = syncScrollToCursor;

      (api as any)._forceUpdateCursor = () => {
        if (!api) return;
        try {
          const tick = api.tickPosition;
          if (api.renderer) api.renderer.updateCursor(tick);
        } catch {}
      };

      api.playerPositionChanged?.on?.((args: any) => {
        const sec = args.currentTime / 1000;
        setCurrentTime(sec);

        const lB = loopBRef.current;
        const lA = loopARef.current;
        if (lB !== null && lA !== null && sec >= lB && api.playerState === 1) {
          api.timePosition = lA * 1000;
          return;
        }

        const dur = lastChordEndTimeRef.current;
        if (dur > 0 && sec >= dur && api.playerState === 1) {
          try {
            if (api.playerState === 1) {
              api.playPause();
            }
            api.timePosition = 0;
          } catch {}
          return;
        }

        if (!alphaTabApiRef.current?.isReadyForPlayback) return;
        const isCurrentlyPlaying = api.playerState === 1;
        if (!isCurrentlyPlaying) {
          requestAnimationFrame(() => syncScrollToCursor());
        }
      });

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
              if (api.playerState === 0) {
                api.playPause();
              }
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
        setPlayerError("正在加载高质量 GM 吉他音源 (约5.8MB)...");
        const res = await fetch(ALPHATAB_SOUNDFONT_URL, { cache: "force-cache" });
        if (!isMountedRef.current) {
          api.destroy();
          return;
        }
        if (!res.ok) throw new Error(`soundfont http ${res.status}`);
        const buf = await res.arrayBuffer();
        api.loadSoundFont(buf, false);
        setPlayerError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPlayerError("音源加载失败，将使用无声模式：" + msg);
        setIsInitializing(false);
      }

      try {
        let ok = false;
        loadedGp5DataRef.current = gp5Data;
        try { ok = api.load(gp5Data); } catch { ok = false; }
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

  useEffect(() => {
    const api = alphaTabApiRef.current;
    if (!api || !gp5Data) return;
    if (loadedGp5DataRef.current === gp5Data) return;
    try {
      setTracks([]);
      if (activeTrackIndexRef.current !== 0) {
        setActiveTrackIndex(0);
      }
      loadedGp5DataRef.current = gp5Data;
      let ok = false;
      try { ok = api.load(gp5Data); } catch { ok = false; }
      if (!ok) {
        setPlayerError("谱例加载失败");
        loadedGp5DataRef.current = null;
      } else {
        setPlayerError(null);
      }
    } catch {}
  }, [gp5Data]);

  const activeTrackIndexRef = useRef(0);
  useEffect(() => { activeTrackIndexRef.current = activeTrackIndex; }, [activeTrackIndex]);

  const handleTrackSwitch = (index: number) => {
    if (!alphaTabApiRef.current) return;
    try {
      alphaTabApiRef.current.renderTracks([index]);
      setActiveTrackIndex(index);
    } catch {}
  };

  const setSoloTrack = (index: number) => {
    if (!alphaTabApiRef.current) return;
    try {
      alphaTabApiRef.current.changeTrackSolo([index], true);
      setTracks(prev => prev.map(t => ({ ...t, isSolo: t.index === index })));
    } catch {}
  };

  const handlePlayPause = () => {
    if (!alphaTabApiRef.current) {
      ensureEngine(true);
      return;
    }
    if (!alphaTabApiRef.current.isReadyForPlayback) {
      ensureEngine(true);
      return;
    }

    if (isPlaying) {
      try {
        alphaTabApiRef.current.playPause();
      } catch {}
    } else if (countdown !== null) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    } else {
      const tempo = practiceData?.metadata?.tempo || 120;
      const safeBpm = Math.max(60, Math.min(240, tempo));
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
          try {
            if (alphaTabApiRef.current?.playerState === 0) {
              alphaTabApiRef.current.playPause();
            }
          } catch {}
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
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
    }
    if (!alphaTabApiRef.current) return;

    const targetIdealTime = block?.startTime ?? timeSeconds;
    const targetRealTime = block?.realStartTime ?? timeSeconds;

    alphaTabApiRef.current.timePosition = targetIdealTime * 1000;
    setCurrentTime(targetIdealTime);

    if (audioRef.current && audioSource !== "midi") {
      audioRef.current.currentTime = targetRealTime;
    }

    if (alphaTabApiRef.current.playerState !== 1) {
      if ((alphaTabApiRef.current as any)._forceUpdateCursor) {
        (alphaTabApiRef.current as any)._forceUpdateCursor();
      }
    }

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

  const chordBlocks = useMemo(() => {
    const safeBpm = bpm || 120;
    const rawChordBlocks: (ChordBlock & { realStartTime: number, realEndTime: number })[] = practiceData?.chordBlocks?.map((b: any, i: number) => {
      let chordName = b.chord;
      if (level < 4 && chordName && chordName !== "N" && chordName !== "None") {
        chordName = chordName.replace(/maj7|maj|m7|sus2|sus4|sus|7/g, (match: string) => match === "m7" ? "m" : "");
        if (chordName.includes("/")) {
          chordName = chordName.split("/")[0];
        }
      }
      return {
        id: `chord-${i}`,
        chord: chordName,
        realStartTime: b.startTime,
        realEndTime: b.endTime,
        startTime: (b.startBeat * 60) / safeBpm,
        endTime: (b.endBeat * 60) / safeBpm,
        startBeat: b.startBeat,
        endBeat: b.endBeat,
        isBarStart: b.isBarStart,
        isBarEnd: b.isBarEnd,
        section: b.section,
      };
    }) || [];

    if (!rawChordBlocks.length) return [];
    const transposed = rawChordBlocks.map(b => {
      if (transpose === 0 || b.chord === "N" || b.chord === "None") return b;
      try {
        const transposedName = Chord.transpose(b.chord, Interval.fromSemitones(transpose));
        return { ...b, chord: transposedName || b.chord };
      } catch {
        return b;
      }
    });
    return transposed.map(b => ({ ...b, count: 1 }));
  }, [practiceData?.chordBlocks, transpose]);

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

  const activeChordIndex = useMemo(() => {
    if (!chordBlocks?.length) return -1;
    return findActiveIndex(chordBlocks, currentTime);
  }, [chordBlocks, currentTime]);

  const chordLyrics = useMemo(() => {
    const rawLyrics = practiceData?.lyrics || [];
    if (!chordBlocks?.length || !rawLyrics.length) return [];
    const blockTexts: string[] = new Array(chordBlocks.length).fill("");
    rawLyrics.forEach((l: any) => {
      const mid = (l.startTime + l.endTime) / 2;
      let bestBlockIdx = -1;
      let minDistance = Infinity;
      for (let i = 0; i < chordBlocks.length; i++) {
        const block: any = chordBlocks[i];
        if (mid >= block.realStartTime && mid < block.realEndTime) {
          bestBlockIdx = i;
          break;
        }
        let dist = 0;
        if (mid < block.realStartTime) dist = block.realStartTime - mid;
        else dist = mid - block.realEndTime;
        if (dist < minDistance) {
          minDistance = dist;
          bestBlockIdx = i;
        }
      }
      if (bestBlockIdx !== -1) blockTexts[bestBlockIdx] += l.text;
    });
    return chordBlocks.map((block: any, i: number) => ({
      text: blockTexts[i].trim(),
      startTime: block.startTime,
      endTime: block.endTime,
    }));
  }, [chordBlocks, practiceData?.lyrics]);

  const displayTitle = songTitle || practiceData?.metadata?.title || practiceData?.title || "未知曲目";
  const currentChordBlock = chordBlocks[activeChordIndex] || chordBlocks[0];

  const handleLoopSet = (type: "A" | "B" | "clear") => {
    if (type === "clear") {
      setLoopA(null);
      setLoopB(null);
    } else if (type === "A") {
      setLoopA(currentChordBlock?.startTime ?? currentTime);
      setLoopB(null);
    } else if (type === "B") {
      const targetB = currentChordBlock?.endTime ?? currentTime;
      if (loopA !== null && targetB <= loopA) {
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

      {onLevelChange && (
        <div className="flex flex-col gap-2 mb-2">
          <div className="text-xs font-serif tracking-widest text-zinc-400">选择练习难度：</div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 1, icon: "🌱", label: "启蒙", desc: "只练左手换和弦" },
              { id: 2, icon: "🌿", label: "小白", desc: "基础四分音符" },
              { id: 3, icon: "🌳", label: "初级", desc: "流行万能节奏" },
              { id: 4, icon: "🔥", label: "中级", desc: "智能原版编配" }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => onLevelChange(l.id)}
                className={`group flex items-center gap-3 px-4 py-2 border rounded-none transition-all duration-300 ${
                  level === l.id
                    ? "bg-zinc-100 text-zinc-900 border-zinc-100 shadow-sm"
                    : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800"
                }`}
              >
                <span className="text-base">{l.icon}</span>
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-medium ${level === l.id ? "text-zinc-900" : "text-zinc-200"}`}>{l.label}</span>
                  <span className={`text-[10px] ${level === l.id ? "text-zinc-600" : "text-zinc-500 group-hover:text-zinc-400"}`}>{l.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {tracks.length > 1 && (
          <div className="flex gap-2 mb-[-8px]">
            {tracks.map(t => (
              <div key={t.index} className="flex items-center gap-2">
                <button
                  onClick={() => handleTrackSwitch(t.index)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    activeTrackIndex === t.index
                      ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                      : 'bg-zinc-800/50 text-zinc-200 hover:bg-zinc-800 border border-zinc-800/50'
                  }`}
                >
                  {t.name}
                </button>
                <button
                  onClick={() => setSoloTrack(t.index)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors border ${
                    t.isSolo
                      ? 'bg-yellow-500 text-zinc-950 border-yellow-400'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  独奏
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4 items-stretch h-auto min-h-[160px]">
          <div className="flex-shrink-0 flex items-center justify-center bg-zinc-900 border border-zinc-800 p-4 md:w-[160px] rounded-none">
            <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          </div>
          <div
            className="flex-1 w-full rounded-none bg-zinc-50 overflow-hidden border border-zinc-800 relative min-h-[160px]"
          >
            <div
              ref={containerRef}
              className="absolute inset-0 overflow-x-auto overflow-y-hidden"
              style={{
                transform: "translateY(-8px)",
                height: "calc(100% + 16px)"
              }}
            />
          </div>
        </div>
        <div className="h-[100px] w-full">
          <SyncedLyrics lyrics={chordLyrics} activeIndex={activeChordIndex} countdown={countdown} />
        </div>
      </div>

      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
      <ChordTimeline
        blocks={chordBlocks}
        activeIndex={activeChordIndex}
        onSeek={(time, block) => handleSeek(time, block)}
        loopA={loopA}
        loopB={loopB}
        duration={lastChordEndTime}
      />

      <PlaybackControls
        isPlaying={isPlaying || countdown !== null}
        isPlayerReady={isPlayerReady}
        isLoading={isInitializing}
        currentTime={currentTime}
        duration={lastChordEndTime}
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
        audioSource={audioSource}
        onAudioSourceChange={setAudioSource}
      />
    </div>
  );
}
