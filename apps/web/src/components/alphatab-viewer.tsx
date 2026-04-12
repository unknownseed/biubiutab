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

type SanitizeLevel = "normal" | "noInlineLyrics" | "noTextEffects" | "bareNotes";

function sanitizeAlphaTex(tex: string, level: SanitizeLevel): string {
  // Defensive alphaTex sanitization.
  // We prefer to keep rich annotations (lyrics/txt) but alphaTab can crash on some
  // edge cases (observed: bottomY undefined). In that case we retry with a more
  // conservative tex.
  let out = tex
    // Remove global \lyrics lines (we already emit per-note lyrics effects).
    .split(/\r?\n/)
    .filter((line) => !/^\s*\\lyrics\b/.test(line))
    .join("\n");

  if (level === "noInlineLyrics" || level === "noTextEffects") {
    // Remove per-note lyrics effects inside `{ ... }`.
    out = out.replace(/\blyrics\s+"([^"\\]|\\.)*"/g, "").replace(/\s{2,}/g, " ");
  }

  if (level === "noTextEffects") {
    // Remove text labels which might include non-ascii chars and trigger layout bugs.
    out = out
      .replace(/\btxt\s+"([^"\\]|\\.)*"/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\{\s+/g, "{ ")
      .replace(/\s+\}/g, " }");
  }

  if (level === "bareNotes") {
    // As a last resort, keep only the minimal subset of per-note effects needed
    // for a readable rhythm: `slashed` + direction + optional chord name.
    // This avoids stripping `slashed` (otherwise the tab becomes repeated 0-fret notes,
    // which looks "wrong" to users).
    out = out
      .replace(/\{\s*([^}]*)\}/g, (_m, inner: string) => {
        const keep: string[] = [];
        if (/\bslashed\b/.test(inner)) keep.push("slashed");
        // Keep stroke direction if present
        if (/\bsd\b/.test(inner)) keep.push("sd");
        if (/\bsu\b/.test(inner)) keep.push("su");
        // Keep chord name label if present
        const ch = inner.match(/\bch\s+"([^"\\]|\\.)*"/);
        if (ch) keep.push(ch[0]);
        return keep.length ? `{ ${keep.join(" ")} }` : "";
      })
      .replace(/\s{2,}/g, " ")
      .replace(/\s+\|/g, " |")
      .replace(/\{\s*\}/g, "");
  }

  return out.trimEnd() + "\n";
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
  { tex: string; filename?: string; titleText?: string; keyText?: string; tempoBpm?: number }
>(function AlphaTabViewer({ tex, filename, titleText, keyText, tempoBpm }, ref) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ destroy: () => void; tex: (t: string) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryLevelRef = useRef<SanitizeLevel>("normal");
  const lastTexRef = useRef<string>("");
  const modRef = useRef<typeof import("@coderline/alphatab") | null>(null);
  const retryCountRef = useRef<number>(0);
  const gaveUpRef = useRef<boolean>(false);

  const totalBars = useMemo(() => (tex.match(/\|/g) ?? []).length, [tex]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalBars / BARS_PER_PAGE)), [totalBars]);
  const [page, setPage] = useState<number>(1);
  useEffect(() => setPage(1), [tex]);

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
    // Use a music symbol instead of plain text, to match the common tempo marker style.
    // User requirement: show quarter-note tempo marker.
    return `♩ = ${Math.round(tempoBpm)}`;
  }, [tempoBpm]);

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

  useEffect(() => {
    let cancelled = false;
    lastTexRef.current = tex;
    retryLevelRef.current = "normal";
    retryCountRef.current = 0;
    gaveUpRef.current = false;

    const destroyApi = () => {
      try {
        apiRef.current?.destroy();
      } catch {
        // ignore
      }
      apiRef.current = null;
      if (pageRef.current) pageRef.current.innerHTML = "";
    };

    const tryRenderWithLevel = (level: SanitizeLevel) => {
      if (cancelled) return;
      retryLevelRef.current = level;
      const sanitized = sanitizeAlphaTex(lastTexRef.current, level);
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
          barsPerRow: BARS_PER_ROW,
          startBar: pageStartBar,
          barCount: BARS_PER_PAGE,
          // Remove internal border padding so our external title/key aligns with the tuning label.
          padding: [0, 0, 0, 0],
          stylesheet: {
            globalDisplayChordDiagramsOnTop: false,
            globalDisplayChordDiagramsInScore: true,
          },
        },
      });

      // We render title + key outside of alphaTab for better spacing control.
      api.settings.notation.elements.set(mod.NotationElement.ScoreTitle, false);
      api.settings.notation.elements.set(mod.NotationElement.ScoreSubTitle, false);
      // We also render tuning outside of alphaTab to control layout/spacing.
      api.settings.notation.elements.set(mod.NotationElement.GuitarTuning, false);

      api.settings.notation.elements.set(mod.NotationElement.EffectLyrics, true);
      api.settings.notation.elements.set(mod.NotationElement.EffectPickStroke, true);
      api.settings.notation.elements.set(mod.NotationElement.EffectChordNames, true);

      // Hide the "chord diagram list" that alphaTab usually shows near the score title area.
      // We want diagrams to be inline per bar instead.
      api.settings.notation.elements.set(mod.NotationElement.ChordDiagrams, false);

      api.error.on((e: Error) => {
        if (cancelled) return;
        const msg = e?.message || String(e);
        maybeRetryOnBottomY(msg);
        if (!msg.includes("bottomY")) setError(msg);
      });
      api.renderFinished.on(() => {
        if (cancelled) return;
        setError(null);
      });

      apiRef.current = api;
      try {
        api.tex(sanitized);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        maybeRetryOnBottomY(msg);
        if (!msg.includes("bottomY")) setError(msg);
      }
    };

    const maybeRetryOnBottomY = (msg: string) => {
      if (cancelled) return;
      if (!msg.includes("bottomY")) return;
      if (gaveUpRef.current) return;
      if (retryCountRef.current >= 4) {
        setError(`${msg}\n\n（已多次重试仍失败。请点击“下载”把 .atex 发我做最小复现；或直接升级 @coderline/alphatab。）`);
        gaveUpRef.current = true;
        destroyApi();
        return;
      }
      retryCountRef.current += 1;

      if (retryLevelRef.current === "normal") {
        tryRenderWithLevel("noInlineLyrics");
        return;
      }
      if (retryLevelRef.current === "noInlineLyrics") {
        tryRenderWithLevel("noTextEffects");
        return;
      }
      if (retryLevelRef.current === "noTextEffects") {
        tryRenderWithLevel("bareNotes");
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      if (cancelled) return;
      const msg = event.error instanceof Error ? event.error.message : event.message;
      if (!msg) return;
      maybeRetryOnBottomY(msg);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (cancelled) return;
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      maybeRetryOnBottomY(msg);
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    const init = async () => {
      const mod = await import("@coderline/alphatab");
      if (cancelled) return;
      if (!wrapperRef.current) return;
      modRef.current = mod;
      mod.Logger.logLevel = mod.LogLevel.None;
      tryRenderWithLevel("normal");
    };

    void init();
    return () => {
      cancelled = true;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      destroyApi();
    };
  }, [tex, page, pageStartBar]);

  return (
    <div className="flex w-full flex-col gap-2">
      {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div ref={wrapperRef} className="w-full rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3">
          {/* Title */}
          <div className="text-center text-xl font-semibold leading-snug text-zinc-900">{displayTitle}</div>

          {/* Key + Tempo (same row) */}
          <div className="flex items-start justify-between gap-6">
            <div className="text-sm text-zinc-700">{displayKey}</div>
            {displayTempo ? <div className="whitespace-nowrap text-sm text-zinc-700">{displayTempo}</div> : null}
          </div>

          {/* Tuning (below key, aligned left) */}
          <div className="text-sm text-zinc-700">Guitar Standard Tuning</div>

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

      {error ? <pre className="overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">{tex}</pre> : null}
    </div>
  );
});

export default AlphaTabViewer;
