"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";
import TimelineViewer, { type VisualizationPayload } from "./timeline-viewer";

type UploadResponse = {
  storedFilename: string;
  originalFilename: string;
  size: number;
};

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  message?: string | null;
  error?: string | null;
  preview?: unknown;
};

type PreviewStep = "queued" | "loading" | "demucs" | "hpss" | "analysis" | "lyrics" | "melody" | "sections" | "done" | "failed";

function stepLabel(s: PreviewStep | string) {
  switch (s as PreviewStep) {
    case "queued":
      return "排队中";
    case "loading":
      return "读取音频";
    case "demucs":
      return "音源分离";
    case "hpss":
      return "HPSS 分离";
    case "analysis":
      return "和弦/节拍";
    case "lyrics":
      return "歌词识别";
    case "melody":
      return "旋律提取";
    case "sections":
      return "段落检测";
    case "done":
      return "完成";
    case "failed":
      return "失败";
    default:
      return String(s);
  }
}

function getPreviewStep(preview: unknown): string {
  if (!preview || typeof preview !== "object") return "loading";
  const p = preview as Record<string, unknown>;
  return typeof p.step === "string" ? p.step : "loading";
}

function asViz(preview: unknown): VisualizationPayload | null {
  if (!preview || typeof preview !== "object") return null;
  const p = preview as Record<string, unknown>;
  const viz: VisualizationPayload = {};
  if (p.waveform && typeof p.waveform === "object") {
    const w = p.waveform as Record<string, unknown>;
    if (typeof w.duration_sec === "number" && Array.isArray(w.peaks)) {
      viz.waveform = { duration_sec: w.duration_sec, peaks: w.peaks as number[] };
    }
  }
  if (Array.isArray(p.beats)) viz.beats = p.beats as number[];
  if (Array.isArray(p.bars))
    viz.bars = p.bars as unknown as Array<{ bar: number; start: number; end: number; chord: string }>;
  if (Array.isArray(p.lyrics_segments))
    viz.lyrics_segments = p.lyrics_segments as unknown as Array<{ start?: number; end?: number; text?: string }>;
  return Object.keys(viz).length ? viz : null;
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function friendlyErrorMessage(msg: string): string {
  if (/charmap/i.test(msg) && /codec can't encode/i.test(msg)) {
    return [
      "AI 服务输出中文时发生编码错误（常见于 Windows 控制台编码不是 UTF-8）。",
      "建议：用 UTF-8 终端启动 AI 服务，或设置环境变量 PYTHONUTF8=1、PYTHONIOENCODING=utf-8。",
      `原始错误：${msg}`,
    ].join("\n");
  }
  return msg;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(friendlyErrorMessage(text || `Request failed: ${res.status}`));
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(friendlyErrorMessage(text || `Request failed: ${res.status}`));
  }
  return (await res.json()) as T;
}

export default function UploadClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const canStart = useMemo(() => {
    if (!file) return false;
    const isAllowed = file.type === "audio/mpeg" || file.type === "audio/wav" || file.name.endsWith(".mp3") || file.name.endsWith(".wav");
    return isAllowed && file.size <= 50 * 1024 * 1024;
  }, [file]);

  const viz = useMemo(() => asViz(preview), [preview]);
  const previewStep = useMemo(() => getPreviewStep(preview), [preview]);

  const audioRef = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
  }, []);

  const onSeek = useCallback((t: number) => {
    const el = audioElRef.current;
    if (!el || !Number.isFinite(t)) return;
    el.currentTime = t;
    void el.play().catch(() => {});
  }, []);

  async function readDuration(nextFile: File) {
    const url = URL.createObjectURL(nextFile);
    try {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("无法读取音频时长"));
        audio.src = url;
      });
      setDurationSec(audio.duration);
    } catch {
      setDurationSec(null);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function onPickFile(nextFile: File | null) {
    setError(null);
    setJob(null);
    setPreview(null);
    setAudioSrc(null);
    setAudioTime(0);
    setAudioDuration(0);
    setUploadProgress(0);
    setStatus("idle");
    setFile(nextFile);
    setDurationSec(null);
    if (nextFile) void readDuration(nextFile);
  }

  async function uploadWithProgress(selected: File): Promise<UploadResponse> {
    return await new Promise<UploadResponse>((resolve, reject) => {
      const form = new FormData();
      form.append("file", selected);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(xhr.responseText || `上传失败: ${xhr.status}`));
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          reject(new Error("上传返回解析失败"));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误"));
      xhr.send(form);
    });
  }

  async function start() {
    if (!file) return;
    setError(null);

    if (!canStart) {
      setStatus("failed");
      setError("仅支持 MP3/WAV 且最大 50MB");
      return;
    }

    setStatus("uploading");
    setUploadProgress(0);

    try {
      const upload = await uploadWithProgress(file);
      toast.push({ title: "上传成功", description: upload.originalFilename, variant: "success" });
      setStatus("processing");
      setAudioSrc(`/api/uploads/${encodeURIComponent(upload.storedFilename)}`);
      const created = await postJson<JobResponse>("/api/jobs", {
        storedFilename: upload.storedFilename,
        title: upload.originalFilename,
      });
      setJob(created);
      localStorage.setItem(`job:${created.id}:audio`, upload.storedFilename);

      const poll = async () => {
        const latest = await getJson<JobResponse>(`/api/jobs/${created.id}`);
        setJob(latest);
        setPreview(latest.preview ?? null);
        if (latest.status === "succeeded") {
          // Hide in-progress timeline immediately once done (before navigation).
          setStatus("idle");
          setPreview(null);
          toast.push({ title: "生成完成", description: "已生成谱例，正在打开编辑页…", variant: "success" });
          router.push(`/editor/${latest.id}`);
          return;
        }
        if (latest.status === "failed") {
          setStatus("failed");
          const msg = friendlyErrorMessage(latest.error || "处理失败");
          setError(msg);
          toast.push({ title: "生成失败", description: msg, variant: "error" });
          return;
        }
        window.setTimeout(() => void poll(), 800);
      };
      window.setTimeout(() => void poll(), 500);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "未知错误");
      toast.push({ title: "请求失败", description: e instanceof Error ? e.message : "未知错误", variant: "error" });
    }
  }

  return (
    <section className="rounded-none border border-paper-300 bg-white/35 backdrop-blur-sm p-[3rem]">
      <div className="flex flex-col gap-8">
        {status !== "uploading" && status !== "processing" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-serif tracking-widest text-ink-800">音频上传</div>
            </div>

            <div
              className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-4 rounded-none border border-dashed border-wood-400/30 bg-white/40 px-4 py-6 text-center transition-colors duration-500 hover:border-wood-400 hover:bg-white/60"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0] ?? null;
                onPickFile(dropped);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
            >
              <div className="text-wood-400/50 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="text-base font-serif tracking-widest text-ink-800">拖拽音频到这里，或点击选择</div>
              <div className="text-xs text-ink-700/50 font-light tracking-wider">支持 MP3/WAV，最大 50MB</div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </>
        )}

        <div className="flex flex-col gap-6 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-wood-300/20 pt-6">
            <div className="text-ink-800">
              {file ? (
                <span className="font-serif tracking-widest">{file.name}</span>
              ) : (
                <span className="text-ink-700/50 font-light tracking-widest">未选择文件</span>
              )}
            </div>
            <div className="text-ink-700/50 font-light tracking-widest">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""}
              {durationSec != null ? ` · ${formatSeconds(durationSec)}` : ""}
            </div>
          </div>

          {status === "uploading" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-ink-700/70 font-light tracking-widest">
                <span>上传中</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1 overflow-hidden bg-paper-200">
                <div className="h-1 bg-wood-400 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          {status === "processing" && job ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-ink-700/70 font-light tracking-widest">
                <span>{job.message || "处理中"}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-1 overflow-hidden bg-paper-200">
                <div className="h-1 bg-wood-400 transition-all duration-300" style={{ width: `${job.progress}%` }} />
              </div>
            </div>
          ) : null}

          {status === "processing" ? (
            <div className="mt-4 space-y-6">
              <div className="border border-paper-300 bg-white/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-serif tracking-widest text-ink-800">实时分析</div>
                  <div className="text-xs text-ink-700/60 font-light tracking-widest">
                    当前步骤：
                    <span className="ml-2 text-wood-500">
                      {stepLabel(previewStep)}
                    </span>
                  </div>
                </div>
                {audioSrc ? (
                  <audio
                    ref={audioRef}
                    className="mt-4 w-full"
                    controls
                    src={audioSrc}
                    onLoadedMetadata={(e) => setAudioDuration((e.currentTarget as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => setAudioTime((e.currentTarget as HTMLAudioElement).currentTime || 0)}
                  />
                ) : (
                  <div className="mt-4 text-xs text-ink-700/50 font-light tracking-widest animate-pulse">音频预览加载中…</div>
                )}
              </div>

              {viz ? (
                <TimelineViewer viz={viz} currentTime={audioTime} durationSec={audioDuration} onSeek={onSeek} />
              ) : (
                <div className="border border-paper-300 bg-white/40 p-6 text-center text-sm text-ink-700/60 font-light tracking-widest animate-pulse">正在准备波形与和弦预览…</div>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="border border-red-900/20 bg-red-50/50 px-4 py-3 text-sm text-red-900 font-light tracking-wide">{error}</div>
          ) : null}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className={`inline-flex items-center justify-center bg-retro-green px-12 py-4 text-sm font-serif tracking-[0.2em] text-paper-50 border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green disabled:opacity-30 disabled:hover:bg-retro-green disabled:hover:text-paper-50 disabled:hover:border-retro-green disabled:cursor-not-allowed group rounded-none ${(status === "uploading" || status === "processing") ? "" : "animate-breathe"}`}
              onClick={() => void start()}
              disabled={!file || status === "uploading" || status === "processing"}
            >
              <span className="transition-transform duration-500 group-hover:translate-x-2">
                [ {(status === "uploading" || status === "processing") ? "正在分析音乐..." : "开始生成谱例"} ]
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
