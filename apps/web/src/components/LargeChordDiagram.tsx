"use client";

import React, { useMemo } from "react";
import guitarChords from "@tombatossals/chords-db/lib/guitar.json";
import ChordDiagram, { type ChordPosition } from "./ChordDiagram";

export type LargeChordDiagramProps = {
  chord: string;
};

function parseChordName(name: string): { key: string; suffix: string } | null {
  const match = name.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return null;
  let root = match[1];
  let suffix = match[2] || "major";
  if (suffix === "m" || suffix === "min") suffix = "minor";
  if (suffix === "maj") suffix = "major";

  const rootMap: Record<string, string> = {
    "C#": "Csharp", Db: "Csharp",
    "D#": "Eb", Eb: "Eb",
    "F#": "Fsharp", Gb: "Fsharp",
    "G#": "Ab", Ab: "Ab",
    "A#": "Bb", Bb: "Bb"
  };
  root = rootMap[root] || root;

  return { key: root, suffix };
}

function getChordPosition(name: string): ChordPosition | null {
  const parsed = parseChordName(name);
  if (!parsed) return null;
  
  // Find the chord in the database
  // @ts-ignore
  const chordsForKey = guitarChords.chords[parsed.key];
  if (!chordsForKey) return null;
  
  // @ts-ignore
  const chordDef = chordsForKey.find((c: any) => c.suffix === parsed.suffix);
  if (!chordDef || !chordDef.positions || chordDef.positions.length === 0) return null;
  
  return chordDef.positions[0] as ChordPosition;
}

export default function LargeChordDiagram({ chord }: LargeChordDiagramProps) {
  const isNoChord = !chord || chord === "N" || chord === "None";
  
  const position = useMemo(() => {
    if (isNoChord) return null;
    return getChordPosition(chord);
  }, [chord, isNoChord]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-inner min-h-[200px]">
      <div className="text-sm font-medium tracking-wider text-zinc-500 uppercase mb-4">
        当前和弦
      </div>
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl bg-zinc-950/80 p-4 shadow-2xl border border-zinc-800 transition-all duration-300 ${
          !isNoChord ? "scale-105 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.15)]" : ""
        }`}
        style={{ width: "160px", height: "180px" }}
      >
        <div className="mb-2 text-xl font-bold text-yellow-400">{isNoChord ? "-" : chord}</div>
        {!isNoChord && position ? (
          <ChordDiagram position={position} width={100} height={120} color="#fef08a" />
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-600">无</div>
        )}
      </div>
    </div>
  );
}
