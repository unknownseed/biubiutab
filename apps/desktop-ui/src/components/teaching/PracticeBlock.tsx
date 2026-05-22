import { useMemo, useState } from "react";
import PracticeMode from "../practice/PracticeMode";
import { cloudGetBytes } from "../../lib/cloud";

export type PracticeBlockData = {
  title: string;
  gp5Url?: string;
  tempo?: number;
  tips?: string;
  demoVideo?: string;
};

type PracticeBlockProps = {
  data: PracticeBlockData;
  coreChords?: string[];
};

function buildPracticeData(title: string, tempo: number | undefined, coreChords: string[] | undefined) {
  const safeTempo = typeof tempo === "number" && Number.isFinite(tempo) ? tempo : 90;
  const chords = (coreChords && coreChords.length ? coreChords : ["C", "G", "Am", "F"]).slice(0, 8);
  const durationSec = 60;
  const blockLenSec = 4;
  const chordBlocks = Array.from({ length: Math.ceil(durationSec / blockLenSec) }).map((_, i) => {
    const startTime = i * blockLenSec;
    const endTime = Math.min(durationSec, (i + 1) * blockLenSec);
    const startBeat = Math.round((startTime * safeTempo) / 60);
    const endBeat = Math.max(startBeat + 1, Math.round((endTime * safeTempo) / 60));
    return {
      chord: chords[i % chords.length],
      startTime,
      endTime,
      section: title,
      startBeat,
      endBeat,
    };
  });
  return {
    metadata: { durationSec, tempo: safeTempo, title },
    chordBlocks,
    lyrics: [],
  };
}

export default function PracticeBlock({ data, coreChords }: PracticeBlockProps) {
  const [gp5Data, setGp5Data] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const practiceData = useMemo(() => buildPracticeData(data.title, data.tempo, coreChords), [data.title, data.tempo, coreChords]);

  const load = async () => {
    if (!data.gp5Url || isLoading) return;
    setIsLoading(true);
    try {
      const urlPath = data.gp5Url.startsWith("/") ? data.gp5Url : `/${data.gp5Url}`;
      const bytes = await cloudGetBytes(urlPath);
      setGp5Data(bytes);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-paper-300 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-paper-300 bg-paper-50 px-5 py-4">
        <div className="min-w-0">
          <div className="truncate font-serif tracking-widest text-ink-900">{data.title}</div>
          {data.tips ? <div className="mt-1 text-xs text-ink-700/70">{data.tips}</div> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-700/60">
          {typeof data.tempo === "number" ? <span className="rounded-md border border-paper-300 bg-white px-2 py-1 font-mono">BPM {data.tempo}</span> : null}
          {data.gp5Url ? <span className="max-w-[220px] truncate rounded-md border border-paper-300 bg-white px-2 py-1 font-mono">{data.gp5Url}</span> : null}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {data.demoVideo ? (
          <div className="rounded-xl overflow-hidden border border-paper-300">
            <video src={data.demoVideo} controls className="w-full aspect-video bg-black" preload="metadata" />
          </div>
        ) : null}

        {!gp5Data ? (
          <button
            type="button"
            className="w-full rounded-xl border border-paper-300 bg-paper-50 px-4 py-10 text-sm tracking-widest text-ink-900 hover:bg-paper-100 disabled:opacity-50"
            onClick={() => void load()}
            disabled={!data.gp5Url || isLoading}
          >
            {isLoading ? "加载中..." : "加载并开始练习"}
          </button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-paper-300">
            <PracticeMode practiceData={practiceData} gp5Data={gp5Data} songTitle={data.title} />
          </div>
        )}
      </div>
    </div>
  );
}
