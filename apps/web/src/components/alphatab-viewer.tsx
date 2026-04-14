"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

export type AlphaTabViewerHandle = {
  exportSvg: () => Promise<void>;
  exportPng: () => Promise<void>;
  printPdf: () => Promise<void>;
};

function safeFilename(name: string): string {
  const trimmed = name.trim() || "score";
  return trimmed.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink")) clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

async function svgToPngBlob(svgText: string, width: number, height: number, scale: number): Promise<Blob> {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG rasterize failed"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
    });
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

const BARS_PER_PAGE = 20;
const BARS_PER_ROW = 4;

const PRELOAD_FONTS = ["Bravura.woff2"];
let fontsPreloaded = false;
let preloadPromise: Promise<void> | null = null;

async function preloadFonts() {
  if (fontsPreloaded) return;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await Promise.all(
        PRELOAD_FONTS.map(async (f) => {
          const url = `/api/alphatab/font/${f}`;
          const res = await fetch(url, { method: "HEAD" });
          if (!res.ok) {
            console.warn(`[AlphaTab] Failed to preload font ${f}: ${res.status}`);
          }
        })
      );
      fontsPreloaded = true;
    } catch (err) {
      console.error("[AlphaTab] Error preloading fonts:", err);
    }
  })();
  return preloadPromise;
}

function stripAudioExt(name: string): string {
  const trimmed = name.trim();
  return trimmed.replace(/\.(mp3|wav)$/i, "");
}

function keyToDoText(key: string | undefined): string {
  const k = (key || "").trim();
  if (!k) return "";
  const parts = k.split(/\s+/);
  const tonic = parts[0];
  const mode = (parts[1] || "").toLowerCase();
  if (mode === "minor") return `1=${tonic}（${tonic}小调）`;
  return `1=${tonic}（${tonic}大调）`;
}

const AlphaTabViewer = forwardRef<
  AlphaTabViewerHandle,
  {
    data: Uint8Array;
    filename?: string;
    titleText?: string;
    keyText?: string;
    tempoBpm?: number;
    timeSignatureText?: string;
    arrangementText?: string;
  }
>(function AlphaTabViewer({ data, filename, titleText, keyText, tempoBpm, timeSignatureText, arrangementText }, ref) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ destroy: () => void; load: (d: Uint8Array) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modRef = useRef<typeof import("@coderline/alphatab") | null>(null);

  // Instead of counting bars from a tex string, we use 1 for now or ask alphatab after load
  // We'll manage pagination differently or default to showing everything if we can't count bars easily
  const [totalBars, setTotalBars] = useState<number>(1);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalBars / BARS_PER_PAGE)), [totalBars]);
  const [page, setPage] = useState<number>(1);
  useEffect(() => setPage(1), [data]);

  const pageStartBar = useMemo(() => (page - 1) * BARS_PER_PAGE + 1, [page]);
  const pageEndBar = useMemo(() => Math.min(totalBars, page * BARS_PER_PAGE), [page, totalBars]);
  const pageBarRange = useMemo(() => `小节 ${pageStartBar}–${pageEndBar}`, [pageStartBar, pageEndBar]);

  const displayTitle = useMemo(() => {
    const base = stripAudioExt(titleText || filename || "score");
    return base || "score";
  }, [titleText, filename]);
  const displayKey = useMemo(() => keyToDoText(keyText), [keyText]);
  const displayTempo = useMemo(() => {
    if (!tempoBpm || !Number.isFinite(tempoBpm) || tempoBpm <= 0) return "";
    return `♩ = ${Math.round(tempoBpm)}`;
  }, [tempoBpm]);
  const displayTimeSignature = useMemo(() => {
    const ts = (timeSignatureText || "").trim();
    if (!ts) return "";
    // Expected formats: "4/4", "3/4", "6/8"
    return ts.includes("/") ? `${ts}拍` : ts;
  }, [timeSignatureText]);

  useImperativeHandle(
    ref,
    () => ({
      exportSvg: async () => {
        const el = wrapperRef.current;
        if (!el) return;
        const svg = el.querySelector("svg");
        if (!svg) throw new Error("未找到可导出的谱面");
        const base = safeFilename(filename || "score");
        const out = new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
        downloadBlob(`${base}_p${page}.svg`, out);
      },
      exportPng: async () => {
        const el = wrapperRef.current;
        if (!el) return;
        const svg = el.querySelector("svg");
        if (!svg) throw new Error("未找到可导出的谱面");
        const base = safeFilename(filename || "score");
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 1200;
        const height = rect.height || 800;
        const blob = await svgToPngBlob(serializeSvg(svg), width, height, 2);
        downloadBlob(`${base}_p${page}.png`, blob);
      },
      printPdf: async () => {
        const el = wrapperRef.current;
        if (!el) return;
        const svg = el.querySelector("svg");
        if (!svg) throw new Error("未找到可导出的谱面");
        const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeFilename(filename || "score")}</title>
  <style>
    @page { margin: 12mm; }
    body { margin: 0; padding: 0; }
    .pageHeader { font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0 0 6mm; display: flex; justify-content: space-between; }
    svg { width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="pageHeader"><div>第 ${page} / ${pageCount} 页</div><div>${pageBarRange}</div></div>
  ${serializeSvg(svg)}
  <script>
    window.onload = () => { window.focus(); window.print(); };
  </script>
</body>
</html>`;
        const w = window.open("", "_blank");
        if (!w) throw new Error("无法打开打印窗口");
        w.document.open();
        w.document.write(html);
        w.document.close();
      },
    }),
    [filename, page, pageBarRange, pageCount]
  );

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;

    const destroyApi = () => {
      try {
        apiRef.current?.destroy();
      } catch {
        // ignore
      }
      apiRef.current = null;
      if (pageRef.current) pageRef.current.innerHTML = "";
    };

    const tryRenderWithData = () => {
      if (cancelled) return;
      const mod = modRef.current;
      if (!mod) return;
      if (!pageRef.current) return;

      // Silence alphaTab internal console logging
      mod.Logger.logLevel = mod.LogLevel.None;

      destroyApi();

      const api = new mod.AlphaTabApi(pageRef.current, {
        core: { engine: "svg", fontDirectory: "/api/alphatab/font/", useWorkers: false, logLevel: mod.LogLevel.None },
        player: { enablePlayer: false },
        display: {
          scale: 1.0,
          layoutMode: mod.LayoutMode.Page,
          // Show standard score and TAB
          staveProfile: mod.StaveProfile.ScoreTab,
          barsPerRow: BARS_PER_ROW,
          startBar: pageStartBar,
          barCount: BARS_PER_PAGE,
          // Add top padding to prevent bottomY crashes when chord diagrams or sections are rendered above the stave.
          padding: [20, 0, 0, 0],
          stylesheet: {
            globalDisplayChordDiagramsOnTop: true,
            globalDisplayChordDiagramsInScore: false,
          },
          notation: {
            rhythmMode: mod.TabRhythmMode.ShowWithBeams,
          },
        } as any,
      });

      // We render title + key outside of alphaTab for better spacing control.
      // But if we disable ScoreTitle, AlphaTab hides the entire header including Chord Diagrams!
      // So we keep ScoreTitle enabled, but set the title font sizes to 0 to make them invisible.
      api.settings.display.resources.titleFont.size = 0;
      api.settings.display.resources.subTitleFont.size = 0;
      api.settings.display.resources.wordsFont.size = 0;
      
      // We also render tuning outside of alphaTab to control layout/spacing.
      api.settings.notation.elements.set(mod.NotationElement.GuitarTuning, false);

      api.settings.notation.elements.set(mod.NotationElement.EffectLyrics, true);
      api.settings.notation.elements.set(mod.NotationElement.EffectMarker, true);
      // We render strumming direction as lyrics line (below chord diagrams), not as pick-stroke glyphs.
      api.settings.notation.elements.set(mod.NotationElement.EffectPickStroke, false);
      api.settings.notation.elements.set(mod.NotationElement.EffectChordNames, true);
      // Hide tempo/time-signature rendering inside the score (we show them in the header).
      api.settings.notation.elements.set((mod.NotationElement as any).EffectTempo, false);
      api.settings.notation.elements.set((mod.NotationElement as any).StandardNotationTimeSignature, false);
      api.settings.notation.elements.set((mod.NotationElement as any).GuitarTabsTimeSignature, false);
      api.settings.notation.elements.set((mod.NotationElement as any).SlashTimeSignature, false);
      api.settings.notation.elements.set((mod.NotationElement as any).NumberedTimeSignature, false);

      // Spacing tweaks:
      // - Make section markers slightly smaller to reduce collision with chord names.
      const markerFont = api.settings.display.resources.elementFonts.get(mod.NotationElement.EffectMarker);
      if (markerFont) {
        api.settings.display.resources.elementFonts.set(mod.NotationElement.EffectMarker, markerFont.withSize(11));
      }
      const chordNameFont = api.settings.display.resources.elementFonts.get(mod.NotationElement.EffectChordNames);
      if (chordNameFont) {
        api.settings.display.resources.elementFonts.set(mod.NotationElement.EffectChordNames, chordNameFont.withSize(11));
      }
      // Make chord diagrams a bit more compact (visually closer to a 4-fret box).
      const es = api.settings.display.resources.engravingSettings;
      es.chordDiagramFretHeight = Math.round(es.chordDiagramFretHeight * 0.7);
      es.chordDiagramFretSpacing = Math.round(es.chordDiagramFretSpacing * 0.7);
      es.chordDiagramNutHeight = Math.round(es.chordDiagramNutHeight * 0.7);
      es.chordDiagramPaddingY = Math.round(es.chordDiagramPaddingY * 0.8);
      es.chordDiagramStringSpacing = Math.round(es.chordDiagramStringSpacing * 0.85);

      // Hide the "chord diagram list" that alphaTab usually shows near the score title area.
      // Wait, the user specifically requested "请将和弦图一次放在谱例的上方" (Please put the chord diagrams once at the top of the score)
      // So we MUST enable ChordDiagrams! We also want to hide them inline in the score, which is already done via globalDisplayChordDiagramsInScore: false.
      api.settings.notation.elements.set(mod.NotationElement.ChordDiagrams, true);

      api.error.on((e: Error) => {
        if (cancelled) return;
        const msg = e?.message || String(e);
        console.error("AlphaTab Error:", msg);
        setError(msg);
      });
      api.renderFinished.on(() => {
        if (cancelled) return;
        setError(null);
      });
      
      api.scoreLoaded.on((score: any) => {
        if (cancelled) return;
        let maxBars = 0;
        // Simple logic to count the total bars in the score
        for (const track of score.tracks) {
          if (track.staves && track.staves.length > 0 && track.staves[0].bars) {
             maxBars = Math.max(maxBars, track.staves[0].bars.length);
          }
        }
        if (maxBars > 0) setTotalBars(maxBars);
      });

      apiRef.current = api as any;
      try {
        api.load(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    };

    const init = async () => {
      // Preload fonts in parallel with module import
      const [mod] = await Promise.all([
        import("@coderline/alphatab"),
        preloadFonts()
      ]);
      if (cancelled) return;
      if (!wrapperRef.current) return;
      modRef.current = mod;
      mod.Logger.logLevel = mod.LogLevel.None;
      
      // Wait for the container to be visible in the DOM before rendering
      // because AlphaTab SVG layout engine crashes (bottomY) if rendered while display:none
      const observer = new IntersectionObserver((entries) => {
        const isVisible = entries.some(e => e.isIntersecting || e.intersectionRatio > 0 || (wrapperRef.current && wrapperRef.current.offsetWidth > 0));
        // Fallback check for offsetWidth in case IntersectionObserver is weird
        const isActuallyVisible = isVisible || (wrapperRef.current && wrapperRef.current.offsetWidth > 0 && wrapperRef.current.offsetHeight > 0);
        
        if (isActuallyVisible) {
          observer.disconnect();
          if (cancelled) return;
          // Delay initialization slightly to let fonts settle in the browser
          setTimeout(() => {
            if (cancelled) return;
            tryRenderWithData();
          }, 200);
        }
      });
      
      if (wrapperRef.current) {
        observer.observe(wrapperRef.current);
      }
      
      return () => observer.disconnect();
    };

    let cleanupObserver: (() => void) | undefined;
    void init().then(cleanup => { cleanupObserver = cleanup; });

    return () => {
      cancelled = true;
      if (cleanupObserver) cleanupObserver();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      destroyApi();
    };
  }, [data, page, pageStartBar]);

  return (
    <div className="flex w-full flex-col gap-2">
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div ref={wrapperRef} className="w-full rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3">
          {/* Title */}
          <div className="text-center text-xl font-semibold leading-snug text-zinc-900">{displayTitle}</div>

          {/* Key + Tempo (same row) */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-3 text-sm text-zinc-700">
              <div>{displayKey}</div>
              {displayTimeSignature ? <div className="whitespace-nowrap text-zinc-600">{displayTimeSignature}</div> : null}
              {displayTempo ? <div className="whitespace-nowrap text-zinc-600">{displayTempo}</div> : null}
            </div>
          </div>

          {/* Tuning (below key, aligned left) */}
          <div className="text-sm text-zinc-700">Guitar Standard Tuning</div>

          {/* Play order text (no repeats symbols - lyrics-friendly) */}
          {arrangementText ? (
            <div className="text-xs leading-relaxed text-zinc-600">{arrangementText}</div>
          ) : null}

          <div className="mt-2 overflow-auto rounded-md border border-zinc-100 bg-white">
            <div ref={pageRef} />
          </div>

          {/* Pagination moved to bottom for better UX */}
          <div className="flex items-center justify-between gap-2 pt-3">
            <div className="text-xs text-zinc-600">{`第 ${page} / ${pageCount} 页 · ${pageBarRange}`}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                上一页
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">加载吉他谱失败</div> : null}
    </div>
  );
});

export default AlphaTabViewer;
