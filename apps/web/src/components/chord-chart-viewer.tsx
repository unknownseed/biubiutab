"use client";

type ChordAt = {
  chord: string;
  bar: number;
  beat: number;
};

type Section = {
  name: string;
  start_bar: number;
  end_bar: number;
  chords: ChordAt[];
};

export default function ChordChartViewer({
  title,
  artist,
  keyName,
  tempo,
  timeSignature,
  sections,
}: {
  title: string;
  artist?: string | null;
  keyName: string;
  tempo: number;
  timeSignature: string;
  sections: Section[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold text-zinc-950">{title}</div>
          <div className="text-sm text-zinc-600">
            {artist ? <span className="mr-3">Artist: {artist}</span> : null}
            <span className="mr-3">Key: {keyName}</span>
            <span className="mr-3">Tempo: {tempo} BPM</span>
            <span>Time: {timeSignature}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((s, idx) => (
          <div key={`${s.name}-${idx}`} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-950">{s.name}</div>
              <div className="text-xs text-zinc-600">
                {s.end_bar - s.start_bar} bars · {s.start_bar}–{s.end_bar}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {groupSectionByBar(s).map((row, i) => (
                <div key={i} className="font-mono text-sm">
                  <span className="text-zinc-500">| </span>
                  {row.map((c, j) => (
                    <span key={j} className="inline-block min-w-12 pr-3">
                      <span className={c === "N" ? "text-zinc-400" : "text-blue-700 font-semibold"}>{c}</span>
                    </span>
                  ))}
                  <span className="text-zinc-500">|</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupSectionByBar(section: Section): string[][] {
  const bars: Record<number, string[]> = {};
  for (const c of section.chords) {
    const list = bars[c.bar] ?? [];
    if (c.beat === 1 || list.length === 0) {
      list.push(c.chord);
    }
    bars[c.bar] = list;
  }

  const keys = Object.keys(bars)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  const barChords = keys.map((k) => (bars[k]?.[0] ?? "N"));
  const rows: string[][] = [];
  for (let i = 0; i < barChords.length; i += 4) {
    rows.push(barChords.slice(i, i + 4));
  }
  return rows.length ? rows : [["N"]];
}

