"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const resolvedRef = useRef(false);

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
    resolvedRef.current = false;
  };

  const ensureEngine = (): Promise<void> => {
    if (alphaTabApiRef.current) return Promise.resolve();
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = new Promise<void>((resolve, _reject) => {
      resolvedRef.current = false;
      setPlayerError(null);
      setIsPlayerReady(false);
      setIsInitializing(true);

      import("@coderline/alphatab")
        .then((mod) => {
          alphaTabModRef.current = mod;
          if (!isMountedRef.current) { resolve(); return; }
          if (!containerRef.current) { resolve(); return; }
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
              layoutMode: mod.LayoutMode.Horizontal,
              staveProfile: mod.StaveProfile.Tab,
              scale: 1.0,
              barsPerRow: 2,
              padding: [20, 0, 0, 0],
              startBar: 0,
              barCount: 2,
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
            api.playbackSpeed = playbackRate;
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
            if (!resolvedRef.current) {
              resolvedRef.current = true;
              resolve();
            }
          });

          alphaTabApiRef.current = api;

          return fetch(ALPHATAB_SOUNDFONT_URL)
            .then((res) => {
              if (!res.ok) throw new Error(`soundfont http ${res.status}`);
              return res.arrayBuffer();
            })
            .then((buf) => api.loadSoundFont(buf, false));
        })
        .then(() => {
          try {
            loadedGp5DataRef.current = gp5Data;
            alphaTabApiRef.current!.load(gp5Data);
          } catch (e) {
            setPlayerError(e instanceof Error ? e.message : "gp5 load failed");
            if (!resolvedRef.current) { resolvedRef.current = true; resolve(); }
            return;
          }

          const pollId = window.setInterval(() => {
            if (!isMountedRef.current) { window.clearInterval(pollId); return; }
            if (alphaTabApiRef.current?.isReadyForPlayback) {
              window.clearInterval(pollId);
              setIsPlayerReady(true);
              setIsInitializing(false);
              if (!resolvedRef.current) { resolvedRef.current = true; resolve(); }
            }
          }, 200);

          setTimeout(() => {
            window.clearInterval(pollId);
            if (!isMountedRef.current) return;
            if (!resolvedRef.current) {
              setIsPlayerReady(true);
              setIsInitializing(false);
              setPlayerError("播放器初始化超时");
              resolvedRef.current = true;
              resolve();
            }
          }, 12000);
        })
        .catch((e) => {
          setPlayerError(e instanceof Error ? e.message : "engine init failed");
          setIsInitializing(false);
          if (!resolvedRef.current) { resolvedRef.current = true; resolve(); }
        });
    });

    return initPromiseRef.current;
  };

  useEffect(() => {
    ensureEngine();
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
    await ensureEngine();
    const api = alphaTabApiRef.current;
    if (!api) return;

    if (isPlaying) {
      try { api.playPause(); } catch {}
      return;
    }

    if (countdown !== null) {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setCountdown(null);
      return;
    }

    const baseBpm = bpmRef.current || 120;
    const safeBpm = Math.max(60, Math.min(240, baseBpm));
    const intervalMs = (60000 / safeBpm) / (playbackRateRef.current || 1);

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
          void audioRef.current.play().catch(() => {});
        }
        if (api.playerState === 0) api.playPause();
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
    <div className="rounded-none border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-[60px]">
            <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-serif tracking-widest text-zinc-100 truncate">{displayTitle}</div>
            <div className="flex items-center gap-2 mt-1">
              {bpm ? <span className="text-[10px] font-mono text-zinc-400">{Math.round(bpm * playbackRate)} BPM</span> : null}
              <span className="text-[10px] font-serif text-zinc-500">调性 {currentKeyDisplay}</span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePlayPause()}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-zinc-950 shadow-sm transition active:scale-95 ${
              isPlayerReady && !isInitializing
                ? "bg-gradient-to-tr from-yellow-500 to-yellow-300 shadow-yellow-500/20 hover:scale-105"
                : "bg-zinc-800 text-zinc-500"
            }`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isInitializing ? (
              <svg className="h-4 w-4 animate-spin text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className="ml-0.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {playerError ? (
          <div className="mb-3 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{playerError}</div>
        ) : null}

        <div
           className="w-full rounded-none bg-zinc-50 overflow-x-auto overflow-y-hidden border border-zinc-800 relative"
           style={{ height: "130px" }}
         >
           <div
             ref={containerRef}
             className="absolute inset-0"
           />
        </div>

        <div className="mt-2">
          <SyncedLyrics lyrics={chordLyrics} activeIndex={activeChordIndex} countdown={countdown} />
        </div>

        <div className="mt-3">
          <ChordTimeline
            blocks={chordBlocks}
            activeIndex={activeChordIndex}
            onSeek={(time, block) => handleSeek(time, block)}
            loopA={loopA}
            loopB={loopB}
            duration={lastChordEndTime}
            baseBlockWidth={44}
          />
        </div>

        <div className="mt-3">
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
        </div>
      </div>

      {onLevelChange ? (
        <div className="border-t border-zinc-800 px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 1, icon: "🌱", label: "启蒙" },
              { id: 2, icon: "🌿", label: "小白" },
              { id: 3, icon: "🌳", label: "初级" },
              { id: 4, icon: "🔥", label: "中级" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onLevelChange(l.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-none transition-all ${
                  level === l.id
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800"
                }`}
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
    </div>
  );
}
