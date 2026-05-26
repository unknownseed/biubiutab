type MainStageProps = {
  jobId: string | null;
  lessonSlug: string | null;
};

export default function MainStage({ jobId, lessonSlug }: MainStageProps) {
  const active = jobId ? `Job: ${jobId.slice(0, 8)}…` : lessonSlug ? `Lesson: ${lessonSlug}` : null;

  return (
    <div className="flex flex-col flex-1 h-full gap-0">
      <div className="h-[120px] bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-center shrink-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">
          {active ? `${active} — Waveform / Timeline` : "Waveform / Timeline"}
        </div>
      </div>

      <div className="flex-1 bg-zinc-950 border-b border-zinc-800 flex items-center justify-center m-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">
          {active ? `${active} — AlphaTab View` : "AlphaTab — Guitar Tab View"}
        </div>
      </div>

      <div className="h-[120px] bg-zinc-900/80 flex items-center justify-center shrink-0">
        <div className="text-zinc-600 text-xs tracking-widest font-mono">
          {active ? `${active} — Chord + Lyrics` : "Chord Diagram + Synced Lyrics"}
        </div>
      </div>
    </div>
  );
}
