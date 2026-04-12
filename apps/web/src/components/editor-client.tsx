"use client";

import { useEffect, useRef, useState } from "react";

import AlphaTabViewer, { type AlphaTabViewerHandle } from "./alphatab-viewer";
import { useToast } from "./toast-provider";

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
  arrangement: string;
  alphatex: string;
  metadata?: Record<string, unknown> | null;
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
  const viewerRef = useRef<AlphaTabViewerHandle | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const latest = await getJson<JobResponse>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(latest);
        if (latest.status === "failed") {
          setError(latest.error || "处理失败");
          toast.push({ title: "生成失败", description: latest.error || "处理失败", variant: "error" });
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
          toast.push({ title: "谱例已就绪", description: "你可以开始编辑或导出。", variant: "success" });
          return;
        }
        window.setTimeout(() => void poll(), 800);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "未知错误");
        toast.push({ title: "请求失败", description: e instanceof Error ? e.message : "未知错误", variant: "error" });
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, toast]);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(2,6,23,0.08)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-950">谱例</div>
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-50"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  setDownloadOpen((v) => !v);
                }}
              >
                下载
              </button>

              {downloadOpen && result ? (
                <div className="absolute right-0 top-full z-10 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(2,6,23,0.12)]">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      const safe = (result.title || "tab").replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
                      downloadText(`${safe}.atex`, result.alphatex);
                      setDownloadOpen(false);
                    }}
                  >
                    下载 .atex
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      void viewerRef.current?.exportPng();
                      setDownloadOpen(false);
                    }}
                  >
                    导出图片（PNG）
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      void viewerRef.current?.printPdf();
                      setDownloadOpen(false);
                    }}
                  >
                    导出 PDF
                  </button>
                  <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">GP4（即将支持）</div>
                </div>
              ) : null}
            </div>
          </div>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {result ? (
            <AlphaTabViewer
              ref={viewerRef}
              tex={result.alphatex}
              filename={result.title}
              titleText={result.title}
              keyText={result.key}
              tempoBpm={result.tempo}
              timeSignatureText={result.time_signature}
              arrangementText={result.arrangement}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {job?.status === "processing" ? "生成中…请稍候" : "还没有谱例。返回上传页生成一个新的谱例。"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
