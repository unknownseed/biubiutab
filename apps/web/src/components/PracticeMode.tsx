"use client";

import React, { useEffect, useRef, useState } from "react";
import ChordTimeline, { type ChordBlock } from "./ChordTimeline";
import SyncedLyrics from "./SyncedLyrics";
import LargeChordDiagram from "./LargeChordDiagram";
import PlaybackControls from "./PlaybackControls";

export type PracticeModeProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  practiceData: any;
  gp5Data: Uint8Array;
};

export default function PracticeMode({ practiceData, gp5Data }: PracticeModeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const alphaTabApiRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = practiceData?.metadata?.durationSec || 0;

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const mod = await import("@coderline/alphatab");
      if (cancelled || !containerRef.current) return;

      mod.Logger.logLevel = mod.LogLevel.None;

      const api = new mod.AlphaTabApi(containerRef.current, {
        core: {
          engine: "svg",
          useWorkers: false,
          logLevel: mod.LogLevel.None,
        },
        player: {
          enablePlayer: true,
          soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
        },
        display: {
          layoutMode: mod.LayoutMode.Horizontal,
        },
      } as any);

      alphaTabApiRef.current = api;

      api.playerStateChanged.on((args: any) => {
        if (cancelled) return;
        setIsPlaying(args.state === 1); // 1 = playing, 0 = paused, 2 = stopped
      });

      api.playerReady.on(() => {
        if (cancelled) return;
        setIsPlayerReady(true);
      });

      api.playerPositionChanged.on((args: any) => {
        if (cancelled) return;
        // args.currentTime is in milliseconds
        setCurrentTime(args.currentTime / 1000);
      });

      api.scoreLoaded.on(() => {
        if (cancelled) return;
        // score loaded successfully
      });

      api.error.on((e: any) => {
        console.error("AlphaTab Player Error:", e);
      });

      try {
        api.load(gp5Data);
      } catch (e) {
        console.error("Failed to load gp5 data:", e);
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (alphaTabApiRef.current) {
        try {
          alphaTabApiRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [gp5Data]);

  const handlePlayPause = () => {
    if (!alphaTabApiRef.current) return;
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
        className="absolute -left-[9999px] top-0 h-[600px] w-[800px] opacity-0 pointer-events-none overflow-hidden"
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LargeChordDiagram chord={currentChordBlock?.chord || "N"} />
        <SyncedLyrics lyrics={lyrics} currentTime={currentTime} />
      </div>

      <ChordTimeline
        blocks={chordBlocks}
        currentTime={currentTime}
        onSeek={(time) => handleSeek(time)}
      />

      <PlaybackControls
        isPlaying={isPlaying}
        isPlayerReady={isPlayerReady}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
      />
    </div>
  );
}
