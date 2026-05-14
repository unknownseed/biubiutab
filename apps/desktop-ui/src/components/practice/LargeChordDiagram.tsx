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
    "C#": "Csharp",
    Db: "Csharp",
    "D#": "Eb",
    Eb: "Eb",
    "F#": "Fsharp",
    Gb: "Fsharp",
    "G#": "Ab",
    Ab: "Ab",
    "A#": "Bb",
    Bb: "Bb",
  };
  root = rootMap[root] || root;

  return { key: root, suffix };
}

function getChordPosition(name: string): ChordPosition | null {
  const parsed = parseChordName(name);
  if (!parsed) return null;

  const chordsForKey = (guitarChords as any).chords?.[parsed.key];
  if (!chordsForKey) return null;

  const chordDef = chordsForKey.find((c: any) => c.suffix === parsed.suffix);
  if (!chordDef || !chordDef.positions || chordDef.positions.length === 0) return null;

  return chordDef.positions[0] as ChordPosition;
}

export const LargeChordDiagram = React.memo(function LargeChordDiagram({ chord }: LargeChordDiagramProps) {
  const isNoChord = !chord || chord === "N" || chord === "None";

  const position = useMemo(() => {
    if (isNoChord) return null;
    return getChordPosition(chord);
  }, [chord, isNoChord]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-paper-300 bg-white p-3 shadow-inner min-h-[140px]">
      <div
        className={`relative flex flex-col items-center justify-center rounded-lg bg-paper-50 p-2 shadow border border-paper-300 transition-all duration-300 ${
          !isNoChord ? "scale-[1.02] border-wood-400/50 shadow-[0_0_24px_rgba(234,179,8,0.15)]" : ""
        }`}
        style={{ width: "110px", height: "130px" }}
      >
        <div className="mb-0.5 text-base font-bold text-wood-500">{isNoChord ? "-" : chord}</div>
        {!isNoChord && position ? (
          <ChordDiagram position={position} width={74} height={92} color="#ca8a04" />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-700/40">无</div>
        )}
      </div>
    </div>
  );
});

export default LargeChordDiagram;

