"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
};

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function UploadClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);

  const canStart = useMemo(() => {
    if (!file) return false;
    const isAllowed = file.type === "audio/mpeg" || file.type === "audio/wav" || file.name.endsWith(".mp3") || file.name.endsWith(".wav");
    return isAllowed && file.size <= 50 * 1024 * 1024;
  }, [file]);

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
      setStatus("processing");
      const created = await postJson<JobResponse>("/api/jobs", {
        storedFilename: upload.storedFilename,
        title: upload.originalFilename,
      });
      setJob(created);
      localStorage.setItem(`job:${created.id}:audio`, upload.storedFilename);

      const poll = async () => {
        const latest = await getJson<JobResponse>(`/api/jobs/${created.id}`);
        setJob(latest);
        if (latest.status === "succeeded") {
          router.push(`/editor/${latest.id}`);
          return;
        }
        if (latest.status === "failed") {
          setStatus("failed");
          setError(latest.error || "处理失败");
          return;
        }
        window.setTimeout(() => void poll(), 800);
      };
      window.setTimeout(() => void poll(), 500);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "未知错误");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium">音频上传</div>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "uploading" || status === "processing"}
          >
            选择文件
          </button>
        </div>

        <div
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center"
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
          <div className="text-sm text-zinc-700">拖拽文件到这里或点击上传</div>
          <div className="text-xs text-zinc-500">支持 MP3/WAV，最大 50MB</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-zinc-700">
              {file ? (
                <span className="font-medium">{file.name}</span>
              ) : (
                <span className="text-zinc-500">未选择文件</span>
              )}
            </div>
            <div className="text-zinc-500">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""}
              {durationSec != null ? ` · ${formatSeconds(durationSec)}` : ""}
            </div>
          </div>

          {status === "uploading" ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>上传中</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-zinc-200">
                <div className="h-2 bg-zinc-900" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          {status === "processing" && job ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>{job.message || "处理中"}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-zinc-200">
                <div className="h-2 bg-zinc-900" style={{ width: `${job.progress}%` }} />
              </div>
            </div>
          ) : null}

          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <button
            type="button"
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
            onClick={() => void start()}
            disabled={!file || status === "uploading" || status === "processing"}
          >
            开始生成
          </button>
        </div>
      </div>
    </section>
  );
}
