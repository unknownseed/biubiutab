import { useEffect, useMemo, useRef, useState } from "react";

export default function AlphaTabViewer({ data }: { data: Uint8Array }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);
  const modRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  const bytes = useMemo(() => data, [data]);

  useEffect(() => {
    let cancelled = false;

    const destroy = () => {
      try {
        apiRef.current?.destroy();
      } catch {}
      apiRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };

    const ensureModule = async () => {
      if (modRef.current) return modRef.current;
      const mod = await import("@coderline/alphatab");
      modRef.current = mod;
      return mod;
    };

    const run = async () => {
      try {
        const mod = await ensureModule();
        if (cancelled) return;
        if (!hostRef.current) return;
        destroy();
        mod.Logger.logLevel = mod.LogLevel.None;
        const api = new mod.AlphaTabApi(hostRef.current, {
          core: {
            engine: "svg",
            fontDirectory: "/alphatab/font/",
            useWorkers: false,
            logLevel: mod.LogLevel.None,
          },
          player: { enablePlayer: false },
          display: {
            scale: 1.0,
            layoutMode: mod.LayoutMode.Page,
            staveProfile: mod.StaveProfile.Tab,
            barsPerRow: 4,
            padding: [20, 0, 0, 0],
          },
          importer: { beatTextAsLyrics: true },
          notation: { rhythmMode: mod.TabRhythmMode.ShowWithBars },
        } as any);

        api.error.on((e: Error) => {
          if (cancelled) return;
          setError(e?.message || String(e));
        });
        api.renderFinished.on(() => {
          if (cancelled) return;
          setError(null);
        });
        api.scoreLoaded.on((score: any) => {
          if (cancelled) return;
          try {
            if (score?.tracks?.length) api.renderTracks(score.tracks);
          } catch {}
        });

        apiRef.current = api;
        api.load(bytes);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "render failed");
      }
    };

    void run();

    return () => {
      cancelled = true;
      destroy();
    };
  }, [bytes]);

  return (
    <div className="w-full">
      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div ref={hostRef} />
    </div>
  );
}

