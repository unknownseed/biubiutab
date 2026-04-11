"use client";

import { useEffect, useRef, useState } from "react";

export default function AlphaTabViewer({ tex }: { tex: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ destroy: () => void; tex: (t: string) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const mod = await import("@coderline/alphatab");
      if (cancelled) return;
      if (!containerRef.current) return;

      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
        containerRef.current.innerHTML = "";
      }

      const api = new mod.AlphaTabApi(containerRef.current, {
        core: { engine: "svg", fontDirectory: "/api/alphatab/font/", useWorkers: false },
        player: { enablePlayer: false },
        display: { scale: 1.0 },
      });
      api.error.on((e: Error) => {
        if (cancelled) return;
        setError(e.message || String(e));
      });
      api.renderFinished.on(() => {
        if (cancelled) return;
        setError(null);
      });
      apiRef.current = api;
      api.tex(tex);
    };

    void init();
    return () => {
      cancelled = true;
      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
      }
    };
  }, [tex]);

  return (
    <div className="flex w-full flex-col gap-2">
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div ref={containerRef} className="w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-2" />
      {error ? <pre className="overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">{tex}</pre> : null}
    </div>
  );
}
