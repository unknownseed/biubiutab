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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(2,6,23,0.08)]">
      <div className="flex flex-col gap-3">
        {status !== "uploading" && status !== "processing" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-950">上传音频</div>
              <button
                type="button"
                className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </button>
            </div>

            <div
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:bg-slate-100"
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
              <div className="text-sm text-slate-700">拖拽文件到这里或点击上传</div>
              <div className="text-xs text-slate-500">支持 MP3/WAV，最大 50MB</div>
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

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-slate-700">
              {file ? (
                <span className="font-medium">{file.name}</span>
              ) : (
                <span className="text-slate-500">未选择文件</span>
              )}
            </div>
            <div className="text-slate-500">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""}
              {durationSec != null ? ` · ${formatSeconds(durationSec)}` : ""}
            </div>
          </div>

          {status === "uploading" ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>上传中</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div className="h-2 bg-[color:var(--primary)]" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          {status === "processing" && job ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{job.message || "处理中"}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div className="h-2 bg-[color:var(--accent)]" style={{ width: `${job.progress}%` }} />
              </div>
            </div>
          ) : null}

          {status === "processing" ? (
            <div className="mt-2 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">实时分析</div>
                  <div className="text-xs text-slate-500">
                    当前步骤：
                    <span className="ml-1 font-medium text-slate-700">
                      {stepLabel(previewStep)}
                    </span>
                  </div>
                </div>
                {audioSrc ? (
                  <audio
                    ref={audioRef}
                    className="mt-2 w-full"
                    controls
                    src={audioSrc}
                    onLoadedMetadata={(e) => setAudioDuration((e.currentTarget as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => setAudioTime((e.currentTarget as HTMLAudioElement).currentTime || 0)}
                  />
                ) : (
                  <div className="mt-2 text-xs text-slate-500">音频预览加载中…</div>
                )}
              </div>

              {viz ? (
                <TimelineViewer viz={viz} currentTime={audioTime} durationSec={audioDuration} onSeek={onSeek} />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">正在准备波形/和弦/歌词预览…</div>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="button"
            className="mt-1 inline-flex items-center justify-center rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-50"
            onClick={() => void start()}
            disabled={!file || status === "uploading" || status === "processing"}
          >
            开始生成谱例
          </button>
        </div>
      </div>
    </section>
  );
}
