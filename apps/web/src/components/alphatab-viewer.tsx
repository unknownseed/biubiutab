"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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

const AlphaTabViewer = forwardRef<AlphaTabViewerHandle, { tex: string; filename?: string }>(function AlphaTabViewer(
  { tex, filename },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ destroy: () => void; tex: (t: string) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryLevelRef = useRef<SanitizeLevel>("normal");
  const lastTexRef = useRef<string>("");
  const modRef = useRef<typeof import("@coderline/alphatab") | null>(null);
  const retryCountRef = useRef<number>(0);
  const gaveUpRef = useRef<boolean>(false);

  useImperativeHandle(
    ref,
    () => ({
      exportSvg: async () => {
        const el = containerRef.current;
        if (!el) return;
        const svgs = Array.from(el.querySelectorAll("svg"));
        const base = safeFilename(filename || "score");
        if (svgs.length === 0) throw new Error("未找到可导出的谱面");
        svgs.forEach((svg, idx) => {
          const text = serializeSvg(svg);
          const out = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
          const suffix = svgs.length > 1 ? `_p${idx + 1}` : "";
          downloadBlob(`${base}${suffix}.svg`, out);
        });
      },
      exportPng: async () => {
        const el = containerRef.current;
        if (!el) return;
        const svgs = Array.from(el.querySelectorAll("svg"));
        const base = safeFilename(filename || "score");
        if (svgs.length === 0) throw new Error("未找到可导出的谱面");
        for (let i = 0; i < svgs.length; i++) {
          const svg = svgs[i];
          const rect = svg.getBoundingClientRect();
          const width = rect.width || 1200;
          const height = rect.height || 800;
          const text = serializeSvg(svg);
          const blob = await svgToPngBlob(text, width, height, 2);
          const suffix = svgs.length > 1 ? `_p${i + 1}` : "";
          downloadBlob(`${base}${suffix}.png`, blob);
        }
      },
      printPdf: async () => {
        const el = containerRef.current;
        if (!el) return;
        const svgs = Array.from(el.querySelectorAll("svg"));
        if (svgs.length === 0) throw new Error("未找到可导出的谱面");

        const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeFilename(filename || "score")}</title>
  <style>
    @page { margin: 12mm; }
    body { margin: 0; padding: 0; }
    .page { break-after: page; page-break-after: always; }
    svg { width: 100%; height: auto; }
  </style>
</head>
<body>
  ${svgs.map((s) => `<div class="page">${serializeSvg(s)}</div>`).join("\n")}
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
    [filename]
  );

  useEffect(() => {
    let cancelled = false;
    lastTexRef.current = tex;
    retryLevelRef.current = "normal";
    retryCountRef.current = 0;
    gaveUpRef.current = false;

    const resetApi = () => {
      if (cancelled) return;
      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      const mod = modRef.current;
      if (!mod || !containerRef.current) return;
      // Silence alphaTab internal console logging (we still handle errors via events + UI).
      mod.Logger.logLevel = mod.LogLevel.None;
      const api = new mod.AlphaTabApi(containerRef.current, {
        core: { engine: "svg", fontDirectory: "/api/alphatab/font/", useWorkers: false, logLevel: mod.LogLevel.None },
        player: { enablePlayer: false },
        display: { scale: 1.0 },
      });
      api.settings.notation.elements.set(mod.NotationElement.EffectLyrics, true);
      api.settings.notation.elements.set(mod.NotationElement.EffectPickStroke, true);
      api.settings.notation.elements.set(mod.NotationElement.EffectChordNames, true);

      api.error.on((e: Error) => {
        if (cancelled) return;
        const msg = e?.message || String(e);
        maybeRetryOnBottomY(msg);
        // If not a bottomY crash, show it.
        if (!msg.includes("bottomY")) setError(msg);
      });
      api.renderFinished.on(() => {
        if (cancelled) return;
        setError(null);
      });

      apiRef.current = api;
    };

    const tryRenderWithLevel = (level: SanitizeLevel) => {
      if (cancelled) return;
      if (!apiRef.current) resetApi();
      const api = apiRef.current;
      if (!api) return;
      retryLevelRef.current = level;
      const sanitized = sanitizeAlphaTex(lastTexRef.current, level);
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
      // Avoid infinite loops when alphaTab keeps erroring in an inconsistent state.
      if (retryCountRef.current >= 4) {
        setError(
          `${msg}\n\n（已多次重试仍失败。请点击“下载”把 .atex 发我做最小复现；或直接升级 @coderline/alphatab。）`
        );
        // Stop further spam in console by destroying the instance.
        gaveUpRef.current = true;
        if (apiRef.current) {
          apiRef.current.destroy();
          apiRef.current = null;
        }
        if (containerRef.current) containerRef.current.innerHTML = "";
        return;
      }
      retryCountRef.current += 1;

      // Retry with a more conservative alphaTex, to avoid alphaTab internal crash.
      if (retryLevelRef.current === "normal") {
        resetApi();
        tryRenderWithLevel("noInlineLyrics");
        return;
      }
      if (retryLevelRef.current === "noInlineLyrics") {
        resetApi();
        tryRenderWithLevel("noTextEffects");
        return;
      }
      if (retryLevelRef.current === "noTextEffects") {
        resetApi();
        tryRenderWithLevel("bareNotes");
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      if (cancelled) return;
      // Some alphaTab runtime errors bypass `api.error`. Surface them to the UI.
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
      if (!containerRef.current) return;
      modRef.current = mod;
      // Silence alphaTab internal console logging.
      mod.Logger.logLevel = mod.LogLevel.None;

      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
        containerRef.current.innerHTML = "";
      }

      resetApi();
      tryRenderWithLevel("normal");
    };

    void init();
    return () => {
      cancelled = true;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
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
});

export default AlphaTabViewer;
