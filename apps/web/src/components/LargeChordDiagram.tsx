"use client";

import React from "react";

export type LargeChordDiagramProps = {
  chord: string;
};

export default function LargeChordDiagram({ chord }: LargeChordDiagramProps) {
  const isNoChord = !chord || chord === "N" || chord === "None";
  const displayChord = isNoChord ? "-" : chord;

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-inner min-h-[200px]">
      <div className="text-sm font-medium tracking-wider text-zinc-500 uppercase mb-4">
        当前和弦
      </div>
      <div
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 p-8 shadow-2xl border border-zinc-800 transition-all duration-300 ${
          !isNoChord ? "scale-105 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.15)]" : ""
        }`}
        style={{ width: "160px", height: "160px" }}
      >
        <span
          className={`text-6xl font-black tracking-tighter ${
            !isNoChord
              ? "bg-gradient-to-br from-yellow-200 to-yellow-500 bg-clip-text text-transparent drop-shadow-md"
              : "text-zinc-700"
          }`}
        >
          {displayChord}
        </span>
      </div>
    </div>
  );
}
