"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

export type AlphaTabViewerHandle = {
  exportSvg: () => Promise<void>;
  printPdf: (w: Window | null) => Promise<void>;
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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

let bravuraFontDataUrlCache: string | null = null;

async function getBravuraFontDataUrl(): Promise<string> {
  if (bravuraFontDataUrlCache) return bravuraFontDataUrlCache;
  try {
    // We use woff instead of woff2 because some browsers (Safari) block woff2 (Brotli) in Canvas SVG context
    const res = await fetch("/alphatab/font/Bravura.woff");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const buffer = await res.arrayBuffer();
    const blob = new Blob([buffer], { type: "font/woff" });
    
    // 转换为 Base64
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    bravuraFontDataUrlCache = dataUrl;
    return dataUrl;
  } catch (err) {
    console.error("[AlphaTab] Failed to load Bravura font for embedding:", err);
    return "";
  }
}

      // No need to inject fonts, removing the unused function

const BARS_PER_PAGE = 20;
const BARS_PER_ROW = 4;

const PRELOAD_FONTS = ["Bravura.woff", "Bravura.woff2"];
let fontsPreloaded = false;
let preloadPromise: Promise<void> | null = null;

async function preloadFonts() {
  if (fontsPreloaded) return;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await Promise.all(
        PRELOAD_FONTS.map(async (f) => {
          const url = `/alphatab/font/${f}`;
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
  const apiRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const modRef = useRef<typeof import("@coderline/alphatab") | null>(null);

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
        const svg = wrapperRef.current?.querySelector("svg");
        if (!svg) throw new Error("未找到可导出的谱面");
        const base = safeFilename(filename || "score");
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const out = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        downloadBlob(`${base}.svg`, out);
      },
      printPdf: async (w: Window | null) => {
        if (!w) throw new Error("无法打开打印窗口");

        const mod = await import("@coderline/alphatab");
        const currentApi = apiRef.current;
        if (!currentApi || !currentApi.score) {
          w.close();
          throw new Error("谱面尚未加载");
        }

        const fontFamily = currentApi.settings?.display?.resources?.smuflFontFamilyName || "alphaTab";
        const fontDataUrl = await getBravuraFontDataUrl();

        // 提取当前页面的所有 AlphaTab 样式
        let globalStyles = "";
        document.querySelectorAll("style").forEach((s) => {
          if (s.textContent?.includes(".at-surface") || s.id.startsWith("alphaTab")) {
            let cleanCss = s.textContent || "";
            cleanCss = cleanCss.replace(/@font-face\s*{[^}]*}/g, "");
            globalStyles += cleanCss + "\n";
          }
        });

        const fontStyle = fontDataUrl
          ? `
@font-face {
  font-family: '${fontFamily}';
  src: url('${fontDataUrl}') format('woff');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'alphaTab';
  src: url('${fontDataUrl}') format('woff');
  font-weight: normal;
  font-style: normal;
}
`
          : "";

        // 写入与 AlphaTab 原生 print() 完全一致的 HTML 结构，并加入我们的字体和样式修复
        w.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${safeFilename(filename || "score")}</title>
            <style>
            ${fontStyle}
            ${globalStyles}
            /* AlphaTab 原生打印防重叠/分页修复 */
            .at-surface {
                width: auto !important;
                height: auto !important;
            }
            .at-surface > div {
                position: relative !important;
                left: auto !important;
                top: auto !important;
                break-inside: avoid;
                page-break-inside: avoid;
            }
            /* 保证打印机线条清晰 */
            @media print {
              svg path, svg line {
                vector-effect: non-scaling-stroke;
              }
            }
            /* 强制应用字体 */
            .at-surface .at, .at-surface text {
              font-family: '${fontFamily}', 'alphaTab', sans-serif !important;
            }
            /* 微调小节数字(通常为红色)和和弦名，使其不要贴得太紧 */
            .at-surface text {
              transform-origin: center;
            }
            /* 针对红色小节数字往上微调 */
            .at-surface text[fill="#ff0000"], .at-surface text[fill="#cc0000"] {
              transform: translateY(-2px);
            }
            </style>
          </head>
          <body></body>
        </html>
        `);
        w.document.close();

        // 在打印窗口中创建一个 A4 宽度的容器
        const a4 = w.document.createElement('div');
        a4.style.width = '210mm';
        w.document.body.appendChild(a4);

        // 创建全新干净的 AlphaTab 配置，避免深拷贝导致的 Map 对象丢失 (m.get is not a function 错误)
        const printSettings = {
          core: {
            engine: "svg",
            fontDirectory: "/alphatab/font/",
            useWorkers: false, // 避免打印窗口产生跨域 Worker 问题
            enableLazyLoading: false, // 强制渲染所有页
            logLevel: mod.LogLevel.None,
            file: null,
            tracks: null,
          },
          player: {
            enablePlayer: false,
            enableCursor: false,
            playerMode: mod.PlayerMode.Disabled,
            enableElementHighlighting: false,
            enableUserInteraction: false,
            soundFont: null,
          },
          display: {
            scale: 0.8, // 缩小一点以适应 A4 纸
            stretchForce: 0.8,
            layoutMode: mod.LayoutMode.Page,
            staveProfile: mod.StaveProfile.Tab,
            barsPerRow: BARS_PER_ROW,
            padding: [20, 0, 0, 0],
          },
          importer: {
            beatTextAsLyrics: true,
          },
          stylesheet: {
            // 将和弦图统一放置在谱子最上方
            globalDisplayChordDiagramsOnTop: true,
            globalDisplayChordDiagramsInScore: false,
          },
          notation: {
            rhythmMode: mod.TabRhythmMode.ShowWithBars,
          },
        };

        // 初始化打印专用的 AlphaTab 实例
        const printApi = new mod.AlphaTabApi(a4, printSettings as any);

        // 覆盖特定间距微调（修复 PDF 中的拥挤问题，去掉原本为了省空间加的缩放参数）
        const es = printApi.settings.display.resources.engravingSettings;
        // 恢复默认，或稍微放大以保证清晰
        es.chordDiagramFretHeight = Math.round(es.chordDiagramFretHeight * 1.0);
        es.chordDiagramFretSpacing = Math.round(es.chordDiagramFretSpacing * 1.0);
        es.chordDiagramNutHeight = Math.round(es.chordDiagramNutHeight * 1.0);
        // 增加和弦图上方的垂直间距，避免和弦名字和空弦 x/o 标记重叠
        es.chordDiagramPaddingY = Math.round(es.chordDiagramPaddingY * 1.5);
        es.chordDiagramStringSpacing = Math.round(es.chordDiagramStringSpacing * 1.0);

        // 稍微调小和弦名和小节数字的字体，避免它们在 0.8 缩放的 PDF 里和弦线重叠
        const fonts = printApi.settings.display.resources.elementFonts;
        const chordFont = fonts.get(mod.NotationElement.EffectChordNames);
        if (chordFont) fonts.set(mod.NotationElement.EffectChordNames, chordFont.withSize(10));
        const barNumberFont = fonts.get(mod.NotationElement.BarNumber);
        if (barNumberFont) fonts.set(mod.NotationElement.BarNumber, barNumberFont.withSize(9));

        // 隐藏不需要的元素
        printApi.settings.notation.elements.set(mod.NotationElement.GuitarTuning, false);
        // 确保不显示吉他谱中间的和弦名字（因为已经在顶部图表中显示了）
        printApi.settings.notation.elements.set(mod.NotationElement.EffectChordNames, false);
        printApi.settings.notation.elements.set((mod.NotationElement as any).EffectTempo, false);
        printApi.settings.notation.elements.set((mod.NotationElement as any).EffectDynamics, false);
        // 强制显示顶部和弦图
        printApi.settings.notation.elements.set(mod.NotationElement.ChordDiagrams, true);

        // 监听渲染完成事件
        let isPrinted = false;
        printApi.postRenderFinished.on(() => {
          if (isPrinted) return;
          isPrinted = true;
          // 给字体加载和浏览器排版留一点时间
          setTimeout(() => {
            w.focus();
            w.print();
          }, 500);
        });

        printApi.error.on((e: any) => {
          console.error("Print rendering failed:", e);
          if (!isPrinted) {
            isPrinted = true;
            w.close();
          }
        });

        w.onunload = () => {
          printApi.destroy();
        };

        // 仅渲染用户当前正在查看的轨道（避免同时渲染两轨导致极其拥挤）
        const trackIndices = currentApi.tracks.map((t: any) => t.index);
        printApi.renderScore(currentApi.score, trackIndices);
      },
    }),
    [filename]
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
        core: {
          engine: "svg",
          fontDirectory: "/alphatab/font/",
          useWorkers: false,
          logLevel: mod.LogLevel.None,
          enableLazyLoading: false,
        },
        player: { enablePlayer: false },
        display: {
          scale: 1.0,
          layoutMode: mod.LayoutMode.Page,
          staveProfile: mod.StaveProfile.Tab,
          barsPerRow: BARS_PER_ROW,
          // Add padding to avoid cut off
          padding: [20, 0, 0, 0],
        },
        importer: {
          beatTextAsLyrics: true,
        },
        stylesheet: {
          // 将和弦图(网格)统一放置在谱子最上方，而不在谱表中间显示，避免拥挤
          globalDisplayChordDiagramsOnTop: true,
          globalDisplayChordDiagramsInScore: false,
        },
        notation: {
          rhythmMode: mod.TabRhythmMode.ShowWithBars,
        },
      } as any);

      // We render title + key outside of alphaTab for better spacing control.
      // But if we disable ScoreTitle, AlphaTab hides the entire header including Chord Diagrams!
      // So we keep ScoreTitle enabled, but set the title font sizes to 0 to make them invisible.
      api.settings.display.resources.titleFont.size = 0;
      api.settings.display.resources.subTitleFont.size = 0;
      // Do NOT set wordsFont.size to 0, because AlphaTab uses it for Lyrics!
      
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

      // Hide dynamic marks (f, mf, p, etc) as we are injecting a lot of humanization velocity changes
      api.settings.notation.elements.set((mod.NotationElement as any).EffectDynamics, false);

      // Spacing tweaks:
      // - Make section markers slightly smaller to reduce collision with chord names.
      const markerFont = api.settings.display.resources.elementFonts.get(mod.NotationElement.EffectMarker);
      if (markerFont) {
        api.settings.display.resources.elementFonts.set(mod.NotationElement.EffectMarker, markerFont.withSize(11));
      }
      const chordNameFont = api.settings.display.resources.elementFonts.get(mod.NotationElement.EffectChordNames);
      if (chordNameFont) {
        api.settings.display.resources.elementFonts.set(mod.NotationElement.EffectChordNames, chordNameFont.withSize(12));
      }

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
        // Render all tracks in the professional score view
        if (score.tracks && score.tracks.length > 1) {
          api.renderTracks(score.tracks);
        }
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
  }, [data]);

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

          {/* The main score container. overflow-visible and h-auto to ensure all pages render without lazy loading cutoff */}
          {/* We set minHeight to ensure it can expand when we force render */}
          <div className="mt-2 overflow-visible min-h-screen h-auto rounded-md border border-zinc-100 bg-white">
            <div ref={pageRef} />
          </div>
        </div>
      </div>

      {error ? <div className="overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-50">加载吉他谱失败</div> : null}
    </div>
  );
});

export default AlphaTabViewer;
