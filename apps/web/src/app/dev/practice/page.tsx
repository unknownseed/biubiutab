"use client";

import { useEffect, useState } from "react";
import PracticeMode from "@/components/PracticeMode";

export default function PracticeDevPage() {
  const [gp5Data, setGp5Data] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch("/test_real.gp5");
      const buf = await res.arrayBuffer();
      if (cancelled) return;
      setGp5Data(new Uint8Array(buf));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const practiceData = {
    metadata: { durationSec: 60 },
    chordBlocks: [
      { chord: "C", startTime: 0, endTime: 4, section: "Intro" },
      { chord: "G", startTime: 4, endTime: 8, section: "Intro" },
      { chord: "Am", startTime: 8, endTime: 12, section: "Verse" },
      { chord: "F", startTime: 12, endTime: 16, section: "Verse" },
    ],
    lyrics: [
      { text: "啦", startTime: 0.5, endTime: 1.0 },
      { text: "啦", startTime: 1.0, endTime: 1.5 },
      { text: "啦", startTime: 1.5, endTime: 2.0 },
    ],
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="text-xl font-semibold text-slate-950">Practice Mode Dev</div>
      {gp5Data ? <PracticeMode practiceData={practiceData} gp5Data={gp5Data} /> : <div className="text-slate-600">Loading…</div>}
    </div>
  );
}
