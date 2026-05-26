export default function MainStage() {
  return (
    <div className="flex flex-col flex-1 h-full gap-0">
      <div className="h-[120px] bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-center shrink-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">Waveform / Timeline</div>
      </div>

      <div className="flex-1 bg-zinc-950 border-b border-zinc-800 flex items-center justify-center m-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">AlphaTab — Guitar Tab View</div>
      </div>

      <div className="h-[120px] bg-zinc-900/80 flex items-center justify-center shrink-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">Chord Diagram + Synced Lyrics</div>
      </div>
    </div>
  );
}
