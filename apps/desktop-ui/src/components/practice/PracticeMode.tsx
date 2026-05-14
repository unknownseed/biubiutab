"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chord, Interval, Note } from "@tonaljs/tonal";
import ChordTimeline, { type ChordBlock, findActiveIndex } from "./ChordTimeline";
import SyncedLyrics, { findActiveLyricIndex } from "./SyncedLyrics";
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
  const alphaTabModRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);
  const loadedGp5DataRef = useRef<Uint8Array | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioSourceRef = useRef<"midi" | "original" | "no_vocals">("midi");
  const playbackRateRef = useRef(1.0);
  const bpmRef = useRef<number>(practiceData?.metadata?.tempo || 120);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const duration = practiceData?.metadata?.durationSec || 0;

  const [audioSource, setAudioSource] = useState<"midi" | "original" | "no_vocals">("midi");
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [transpose, setTranspose] = useState(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number | undefined>(practiceData?.metadata?.tempo);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    bpmRef.current = bpm || practiceData?.metadata?.tempo || 120;
  }, [bpm, practiceData?.metadata?.tempo]);

  const destroyEngine = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
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
      try {
        api.destroy();
      } catch {}
    }
    if (containerRef.current) containerRef.current.innerHTML = "";
    initPromiseRef.current = null;
  };

  const ensureEngine = (autoPlay: boolean): Promise<void> => {
    if (alphaTabApiRef.current) return Promise.resolve();
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      setPlayerError(null);
      setIsPlayerReady(false);
      setIsInitializing(true);

      const mod = alphaTabModRef.current || (await import("@coderline/alphatab"));
      alphaTabModRef.current = mod;
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
          layoutMode: mod.LayoutMode.Page,
          staveProfile: mod.StaveProfile.Tab,
          scale: 1.0,
          barsPerRow: 4,
          padding: [20, 0, 0, 0],
        },
        importer: { beatTextAsLyrics: true },
      } as any);

      api.playerStateChanged?.on?.(() => {
        if (!isMountedRef.current) return;
        setIsPlaying(api.playerState === 1);
        if (audioRef.current) {
          if (api.playerState === 1) {
            void audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }
      });

      api.playerReady?.on?.(() => {
        if (!isMountedRef.current) return;
        setIsPlayerReady(true);
        setIsInitializing(false);
        api.playbackSpeed = playbackRate;
        if (autoPlay && api.playerState === 0) {
          try {
            api.playPause();
          } catch {}
        }
      });

      api.playerPositionChanged?.on?.(() => {
        if (!isMountedRef.current) return;
        const sec = api.timePosition / 1000;
        setCurrentTime(sec);
        if (audioSourceRef.current !== "midi" && audioRef.current && Number.isFinite(audioRef.current.duration)) {
          const safeBpm = bpmRef.current || 120;
          const b0 = practiceData?.chordBlocks?.[0];
          const real0 = typeof b0?.startTime === "number" ? b0.startTime : 0;
          const ideal0 = b0 ? (Number(b0.startBeat || 0) * 60) / safeBpm : 0;
          const offset = Number.isFinite(real0 - ideal0) ? real0 - ideal0 : 0;
          const target = sec + offset;
          if (Math.abs((audioRef.current.currentTime || 0) - target) > 0.25) {
            audioRef.current.currentTime = Math.max(0, target);
          }
        }
        const lA = loopARef.current;
        const lB = loopBRef.current;
        if (lB !== null && lA !== null && sec >= lB && api.playerState === 1) {
          api.timePosition = lA * 1000;
        }
      });

      api.error?.on?.((e: any) => {
        if (!isMountedRef.current) return;
        const msg = e?.message || String(e);
        setPlayerError(msg);
        setIsInitializing(false);
      });

      alphaTabApiRef.current = api;

      try {
        const res = await fetch(ALPHATAB_SOUNDFONT_URL);
        const buf = await res.arrayBuffer();
        api.loadSoundFont(buf, false);
      } catch (e) {
        setPlayerError(e instanceof Error ? e.message : "soundfont load failed");
      }

      try {
        loadedGp5DataRef.current = gp5Data;
        api.load(gp5Data);
      } catch (e) {
        setPlayerError(e instanceof Error ? e.message : "gp5 load failed");
      }

      setIsInitializing(false);
    })();
  };

  useEffect(() => {
    ensureEngine(false);
    return () => destroyEngine();
  }, []);

  useEffect(() => {
    const api = alphaTabApiRef.current;
    if (!api) return;
    if (loadedGp5DataRef.current === gp5Data) return;
    try {
      loadedGp5DataRef.current = gp5Data;
      api.load(gp5Data);
    } catch {}
  }, [gp5Data]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
    const api = alphaTabApiRef.current;
    if (api) api.playbackSpeed = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const api = alphaTabApiRef.current;
    if (!api) return;
    try {
      api.masterVolume = audioSource === "midi" ? 1 : 0;
    } catch {}
    if (!audioRef.current) return;
    if (audioSource === "midi") {
      audioRef.current.pause();
      return;
    }
    if (!jobId || !userId) return;
    let cancelled = false;
    const loadAudio = async () => {
      try {
        const res = await fetch(`${aiBaseUrl()}/jobs/${jobId}/audio?type=${audioSource}`, { headers: { "x-user-id": userId } });
        if (!res.ok) throw new Error("音频加载失败");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const blob = new Blob([buf], { type: res.headers.get("content-type") || "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const prev = audioUrlRef.current;
        audioUrlRef.current = url;
        if (prev) URL.revokeObjectURL(prev);
        audioRef.current!.src = url;
        audioRef.current!.load();
        audioRef.current!.playbackRate = playbackRate;
      } catch (e) {
        if (cancelled) return;
        setPlayerError(e instanceof Error ? e.message : "音频加载失败");
      }
    };
    void loadAudio();
    return () => {
      cancelled = true;
    };
  }, [audioSource, jobId, userId]);

  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  useEffect(() => {
    loopARef.current = loopA;
    loopBRef.current = loopB;
  }, [loopA, loopB]);

  const handlePlayPause = async () => {
    await ensureEngine(true);
    const api = alphaTabApiRef.current;
    if (!api) return;

    if (isPlaying) {
      try {
        api.playPause();
      } catch {}
      return;
    }

    if (countdown !== null) {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      return;
    }

    if (!isPlayerReady) {
      setPlayerError("播放器尚未就绪，请稍候再试。");
      return;
    }

    const baseBpm = bpmRef.current || 120;
    const safeBpm = Math.max(60, Math.min(240, baseBpm));
    const intervalMs = (60000 / safeBpm) / (playbackRateRef.current || 1);

    try {
      if (audioSourceRef.current !== "midi" && audioRef.current) {
        audioRef.current.volume = 0;
        void audioRef.current.play().catch(() => {});
      } else {
        try {
          api.masterVolume = 0;
        } catch {}
      }
    } catch {}

    try {
      api.playPause();
    } catch (e) {
      setPlayerError(e instanceof Error ? e.message : "播放失败");
      return;
    }

    let count = 4;
    setCountdown(count);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        return;
      }
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      try {
        if (audioSourceRef.current !== "midi" && audioRef.current) {
          audioRef.current.volume = 1;
        } else {
          api.masterVolume = 1;
        }
      } catch {}
    }, intervalMs);
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };

  const handleTransposeChange = (semitones: number) => {
    setTranspose(semitones);
  };

  const handleSeek = (timeSeconds: number, block?: any) => {
    const api = alphaTabApiRef.current;
    if (!api) return;
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
    const targetIdealTime = block?.startTime ?? timeSeconds;
    api.timePosition = targetIdealTime * 1000;
    setCurrentTime(targetIdealTime);
    if (audioSourceRef.current !== "midi" && audioRef.current) {
      const safeBpm = bpmRef.current || 120;
      const b0 = practiceData?.chordBlocks?.[0];
      const real0 = typeof b0?.startTime === "number" ? b0.startTime : 0;
      const ideal0 = b0 ? (Number(b0.startBeat || 0) * 60) / safeBpm : 0;
      const offset = Number.isFinite(real0 - ideal0) ? real0 - ideal0 : 0;
      audioRef.current.currentTime = Math.max(0, targetIdealTime + offset);
      if (isPlaying) {
        void audioRef.current.play().catch(() => {});
      }
    }
  };

  const chordBlocks = useMemo(() => {
    const safeBpm = bpm || 120;
    const rawChordBlocks: (ChordBlock & { realStartTime: number; realEndTime: number })[] =
      practiceData?.chordBlocks?.map((b: any, i: number) => {
        let chordName = b.chord;
        if (level < 4 && chordName && chordName !== "N" && chordName !== "None") {
          chordName = chordName.replace(/maj7|maj|m7|sus2|sus4|sus|7/g, (m: string) => (m === "m7" ? "m" : ""));
          if (chordName.includes("/")) chordName = chordName.split("/")[0];
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
          count: 1,
        };
      }) || [];

    if (!rawChordBlocks.length) return [];
    const transposed = rawChordBlocks.map((b) => {
      if (transpose === 0 || b.chord === "N" || b.chord === "None") return b;
      try {
        const transposedName = Chord.transpose(b.chord, Interval.fromSemitones(transpose));
        return { ...b, chord: transposedName || b.chord };
      } catch {
        return b;
      }
    });
    return transposed.map((b) => ({ ...b, count: 1 }));
  }, [practiceData?.chordBlocks, transpose, bpm, level]);

  const currentKeyDisplay = useMemo(() => {
    let originalKey = practiceData?.metadata?.key;
    if (!originalKey) {
      const firstValidChord = practiceData?.chordBlocks?.find((b: any) => b.chord && b.chord !== "N" && b.chord !== "None");
      originalKey = firstValidChord ? Chord.get(firstValidChord.chord).tonic || "C" : "C";
    }
    try {
      const t = Note.transpose(originalKey, Interval.fromSemitones(transpose));
      return Note.simplify(t);
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

  const activeLyricIndex = useMemo(() => {
    if (!chordLyrics.length) return -1;
    return findActiveLyricIndex(chordLyrics, currentTime);
  }, [chordLyrics, currentTime]);

  const displayTitle = songTitle || practiceData?.metadata?.title || practiceData?.title || "未知曲目";
  const currentChordBlock: any = chordBlocks[activeChordIndex] || chordBlocks[0];
  const lastChordEndTime = chordBlocks.length ? chordBlocks[chordBlocks.length - 1].endTime : duration;

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
        setLoopA(currentChordBlock?.startTime ?? currentTime);
        setLoopB(loopA);
      } else {
        setLoopB(targetB);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-paper-100 p-4 sm:p-6 text-ink-900 shadow-sm border border-paper-300">
      {playerError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{playerError}</div> : null}

      {onLevelChange ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-serif tracking-widest text-ink-700/60">选择练习难度：</div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 1, icon: "🌱", label: "启蒙", desc: "只练左手换和弦" },
              { id: 2, icon: "🌿", label: "小白", desc: "基础四分音符" },
              { id: 3, icon: "🌳", label: "初级", desc: "流行万能节奏" },
              { id: 4, icon: "🔥", label: "中级", desc: "智能原版编配" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onLevelChange(l.id)}
                className={`group flex items-center gap-3 px-4 py-2 border rounded-xl transition-all ${
                  level === l.id ? "bg-white text-ink-900 border-paper-300 shadow-sm" : "bg-paper-50 text-ink-700/70 border-paper-300 hover:bg-white"
                }`}
              >
                <span className="text-base">{l.icon}</span>
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-medium ${level === l.id ? "text-ink-900" : "text-ink-800"}`}>{l.label}</span>
                  <span className={`text-[10px] ${level === l.id ? "text-ink-700/60" : "text-ink-700/50"}`}>{l.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch min-h-[160px]">
          <div className="flex-shrink-0 flex items-center justify-center p-4 md:w-[180px] rounded-xl border border-paper-300 bg-white">
            <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          </div>
          <div className="flex-1 w-full rounded-xl bg-white overflow-hidden border border-paper-300 relative min-h-[160px]">
            <div ref={containerRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden" />
          </div>
        </div>

        <div className="h-[100px] w-full">
          <SyncedLyrics lyrics={chordLyrics} activeIndex={activeLyricIndex} countdown={countdown} />
        </div>
      </div>

      <ChordTimeline blocks={chordBlocks} activeIndex={activeChordIndex} onSeek={(time, block) => handleSeek(time, block)} loopA={loopA} loopB={loopB} duration={lastChordEndTime} />

      <PlaybackControls
        isPlaying={isPlaying || countdown !== null}
        isPlayerReady={isPlayerReady}
        isLoading={isInitializing}
        currentTime={currentTime}
        duration={lastChordEndTime}
        onPlayPause={() => void handlePlayPause()}
        onSeek={(t) => handleSeek(t)}
        audioSource={audioSource}
        onAudioSourceChange={setAudioSource}
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
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
    </div>
  );
}
