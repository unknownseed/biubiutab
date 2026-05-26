type TransportBarProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  audioSource: "midi" | "original" | "no_vocals";
  transpose: number;
  currentKey: string;
  bpm: number;
  loopA: number | null;
  loopB: number | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onRateChange: (r: number) => void;
  onSourceChange: (s: "midi" | "original" | "no_vocals") => void;
  onTransposeChange: (s: number) => void;
  onLoopSet: (type: "A" | "B" | "clear") => void;
};

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TransportBar({
  isPlaying, currentTime, duration, playbackRate, audioSource,
  transpose, currentKey, bpm, loopA, loopB,
  onPlay, onPause, onSeek, onRateChange, onSourceChange, onTransposeChange, onLoopSet,
}: TransportBarProps) {
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="flex items-center gap-4 h-[48px] bg-zinc-900 border-t border-zinc-800 px-4 shrink-0">
      <div className="flex items-center gap-2">
        <button onClick={() => onSeek(Math.max(0, currentTime - 5))} className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 19 2 12 11 5"/><polygon points="22 19 13 12 22 5"/></svg>
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`w-8 h-8 flex items-center justify-center rounded-full ${isPlaying ? "bg-yellow-500 text-zinc-950" : "bg-zinc-800 text-yellow-500"}`}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          )}
        </button>

        <button onClick={() => onSeek(Math.min(duration, currentTime + 5))} className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 19 22 12 13 5"/><polygon points="2 19 11 12 2 5"/></svg>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onLoopSet(loopA === null ? "A" : loopB === null ? "B" : "clear")}
          className={`h-6 px-2 text-[10px] font-semibold tracking-wider rounded border ${
            loopA !== null && loopB !== null ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
            : loopA !== null ? "border-yellow-500/40 text-yellow-500"
            : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
          }`}
        >
          {loopA !== null && loopB !== null ? "Loop ON" : loopA !== null ? "Set B" : "Loop"}
        </button>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-[11px] font-mono text-zinc-500 tabular-nums w-12 text-right">{fmt(currentTime)}</span>
        <div className="relative flex-1 h-5 flex items-center group cursor-pointer">
          <div className="absolute left-0 right-0 h-1 rounded-sm bg-zinc-700" />
          <div className="absolute left-0 h-1 rounded-sm bg-yellow-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] font-mono text-zinc-500 tabular-nums w-12">{fmt(duration)}</span>
      </div>

      <div className="flex items-center gap-1 rounded bg-zinc-800 p-0.5">
        {(["midi", "original", "no_vocals"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSourceChange(s)}
            className={`px-2.5 py-1 text-[10px] tracking-wider rounded ${
              audioSource === s ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "midi" ? "MIDI" : s === "original" ? "原曲" : "卡拉OK"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded bg-zinc-800 p-0.5">
        {[0.5, 0.75, 1, 1.25].map((r) => (
          <button
            key={r}
            onClick={() => onRateChange(r)}
            className={`px-2 py-1 text-[10px] font-mono tracking-wider rounded ${
              playbackRate === r ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded bg-zinc-800 p-0.5">
        <button onClick={() => onTransposeChange(transpose - 1)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs">−</button>
        <span className="text-[11px] font-mono text-zinc-300 tracking-wider w-8 text-center">{currentKey}</span>
        <button onClick={() => onTransposeChange(transpose + 1)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs">+</button>
      </div>

      <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
        {Math.round(bpm * playbackRate)} bpm
      </div>
    </div>
  );
}
