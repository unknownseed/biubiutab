"use client";

import { useEffect, useMemo, useRef } from "react";

type VizWaveform = {
  duration_sec: number;
  peaks: number[];
};

type VizBar = { bar: number; start: number; end: number; chord: string };
type VizSegment = { start?: number; end?: number; text?: string };

export type VisualizationPayload = {
  waveform?: VizWaveform | null;
  beats?: number[] | null;
  bars?: VizBar[] | null;
  lyrics_segments?: VizSegment[] | null;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function TimelineViewer({
  viz,
  currentTime,
  durationSec,
  onSeek,
}: {
  viz: VisualizationPayload;
  currentTime: number;
  durationSec: number;
  onSeek: (t: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const duration = useMemo(() => {
    return viz.waveform?.duration_sec || durationSec || 0;
  }, [viz.waveform?.duration_sec, durationSec]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const nextW = Math.max(1, Math.floor(w * dpr));
      const nextH = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();

    const render = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 1 || h <= 1) return;

      // bg
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, w, h);

      const topPad = 10;
      const waveH = 56;
      const chordH = 22;
      const lyricH = 18;
      const waveTop = topPad;
      const waveMid = waveTop + waveH / 2;

      // waveform
      const peaks = viz.waveform?.peaks || [];
      ctx.strokeStyle = "rgba(47, 79, 79, 0.4)"; // retro-green
      ctx.lineWidth = 1;
      if (peaks.length > 0) {
        const step = w / peaks.length;
        ctx.beginPath();
        for (let i = 0; i < peaks.length; i++) {
          const p = clamp(peaks[i] ?? 0, 0, 1);
          const x = i * step;
          const y1 = waveMid - p * (waveH / 2);
          const y2 = waveMid + p * (waveH / 2);
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(47, 79, 79, 0.05)";
        ctx.fillRect(0, waveTop, w, waveH);
      }

      // beats (thin)
      const beats = viz.beats || [];
      if (duration > 0 && beats.length > 0) {
        ctx.strokeStyle = "rgba(47, 79, 79, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const bt of beats) {
          const x = (bt / duration) * w;
          ctx.moveTo(x, waveTop);
          ctx.lineTo(x, waveTop + waveH + chordH + lyricH + 8);
        }
        ctx.stroke();
      }

      // chord bars
      const bars = viz.bars || [];
      const chordTop = waveTop + waveH + 8;
      if (duration > 0 && bars.length > 0) {
        ctx.font = "12px ui-serif, Georgia, Cambria, Times New Roman, Times, serif";
        for (const b of bars) {
          const x0 = (b.start / duration) * w;
          const x1 = (b.end / duration) * w;
          const ww = Math.max(1, x1 - x0);
          ctx.fillStyle = "rgba(234, 179, 8, 0.15)"; // yellow-500
          ctx.fillRect(x0, chordTop, ww, chordH);
          ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
          ctx.strokeRect(x0, chordTop, ww, chordH);
          ctx.fillStyle = "#2F4F4F"; // retro-green
          ctx.fillText(b.chord || "N", x0 + 6, chordTop + 15);
        }
      }

      // lyrics segments (simple)
      const lyricTop = chordTop + chordH + 6;
      const segs = viz.lyrics_segments || [];
      if (duration > 0 && segs.length > 0) {
        ctx.fillStyle = "rgba(47, 79, 79, 0.05)"; // retro-green
        ctx.strokeStyle = "rgba(47, 79, 79, 0.2)"; // retro-green
        ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        for (const s of segs) {
          const t0 = Number(s.start ?? 0);
          const t1 = Number(s.end ?? t0);
          if (!(t1 > t0)) continue;
          const x0 = (t0 / duration) * w;
          const x1 = (t1 / duration) * w;
          const ww = Math.max(1, x1 - x0);
          ctx.fillRect(x0, lyricTop, ww, lyricH);
          ctx.strokeRect(x0, lyricTop, ww, lyricH);
        }
      }

      // playhead
      const t = currentTime ?? 0;
      if (duration > 0) {
        const x = (t / duration) * w;
        ctx.strokeStyle = "#EAB308"; // yellow-500
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    };

    let raf = 0;
    const loop = () => {
      render();
      raf = window.requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [viz, duration, currentTime]);

  return (
    <div className="border border-retro-green bg-retro-green/5 p-4 mt-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-serif tracking-widest text-retro-green font-medium">分析时间轴</div>
        <div className="text-xs text-ink-700/60 font-light tracking-widest">波形：伴奏 / 伴唱</div>
      </div>
      <div className="mt-4">
        <canvas
          ref={canvasRef}
          className="h-[120px] w-full cursor-pointer border border-retro-green/20 bg-white/50 backdrop-blur-sm"
          onClick={(e) => {
            if (!duration) return;
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const x = clamp(e.clientX - rect.left, 0, rect.width);
            const t = (x / rect.width) * duration;
            onSeek(t);
          }}
        />
        <div className="mt-3 text-xs text-ink-700/60 font-light tracking-wider">
          点击任意位置跳转播放；棕色块=和弦小节；细条=歌词时间段；细线=节拍。
        </div>
      </div>
    </div>
  );
}
