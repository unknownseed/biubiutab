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
        },
        display: {
          scale: 1.0,
          layoutMode: mod.LayoutMode.Page,
          staveProfile: mod.StaveProfile.ScoreTab,
          barsPerRow: 4,
          padding: [20, 0, 0, 0],
        },
        importer: {
          beatTextAsLyrics: true,
        },
        stylesheet: {
          globalDisplayChordDiagramsOnTop: true,
          globalDisplayChordDiagramsInScore: false,
        },
        notation: {
          rhythmMode: mod.TabRhythmMode.ShowWithBeams,
        },
      } as any);

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

      api.playerPositionChanged?.on?.((args: any) => {
        setCurrentTime(args.currentTime / 1000);
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

  useEffect(() => destroyEngine, []);

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
      {/* Off-screen AlphaTab container for audio engine only. Must have valid width/height so AlphaTab doesn't skip layout. */}
      <div
        ref={containerRef}
        className="absolute opacity-0 pointer-events-none overflow-hidden"
        style={{ left: "-9999px", top: 0, width: "800px", height: "600px" }}
      />

      {playerError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {playerError}
        </div>
      ) : null}

      <PlaybackControls
        isPlaying={isPlaying}
        isPlayerReady={isPlayerReady}
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
        <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
        <SyncedLyrics lyrics={lyrics} currentTime={currentTime} />
      </div>
    </div>
  );
}
