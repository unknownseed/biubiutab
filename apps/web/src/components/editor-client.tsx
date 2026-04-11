"use client";

import { useEffect, useMemo, useState } from "react";

import AlphaTabViewer from "@/components/alphatab-viewer";

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  message?: string | null;
  error?: string | null;
};

type ChordAt = {
  chord: string;
  bar: number;
  beat: number;
};

type Section = {
  name: string;
  start_bar: number;
  end_bar: number;
  chords: ChordAt[];
};

type JobResult = {
  title: string;
  artist?: string | null;
  key: string;
  tempo: number;
  time_signature: string;
  sections: Section[];
  alphatex: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EditorClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState<string | null>(null);

  useEffect(() => {
    setAudioFilename(localStorage.getItem(`job:${jobId}:audio`));
  }, [jobId]);

  const audioSrc = useMemo(() => {
    if (!audioFilename) return null;
    return `/api/uploads/${encodeURIComponent(audioFilename)}`;
  }, [audioFilename]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const latest = await getJson<JobResponse>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(latest);
        if (latest.status === "failed") {
          setError(latest.error || "处理失败");
          return;
        }
        if (latest.status === "succeeded") {
          const res = await getJson<JobResult>(`/api/jobs/${jobId}/result`);
          if (cancelled) return;
          if (typeof (res as unknown as { alphatex?: unknown }).alphatex !== "string" || !res.alphatex.trim()) {
            setError("谱面数据为空（后端未返回 alphatex）。请重启 AI 服务与 Web 后重试。");
            return;
          }
          setResult(res);
          return;
        }
        window.setTimeout(() => void poll(), 800);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "未知错误");
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-900">播放</div>
            {job ? (
              <div className="text-xs text-zinc-600">
                {job.status === "processing" ? `${job.message || "处理中"} · ${job.progress}%` : job.status}
              </div>
            ) : null}
          </div>
          {audioSrc ? (
            <audio className="w-full" controls src={audioSrc} />
          ) : (
            <div className="text-sm text-zinc-600">未找到音频文件（本地开发模式下需从首页进入）。</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-900">谱例</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  void navigator.clipboard.writeText(result.alphatex);
                }}
              >
                复制
              </button>
              <button
                type="button"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  const safe = (result.title || "tab").replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
                  downloadText(`${safe}.atex`, result.alphatex);
                }}
              >
                下载
              </button>
            </div>
          </div>
          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {result ? (
            <AlphaTabViewer tex={result.alphatex} />
          ) : (
            <div className="text-sm text-zinc-600">等待生成结果…</div>
          )}
        </div>
      </div>
    </section>
  );
}
