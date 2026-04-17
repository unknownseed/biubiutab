"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import AlphaTabViewer, { type AlphaTabViewerHandle } from "./alphatab-viewer";
import PracticeMode from "./PracticeMode";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  practiceData?: any;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function EditorClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [gp5Data, setGp5Data] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<AlphaTabViewerHandle | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"full" | "practice">("practice");
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
          setResult(res);
          
          try {
            const gp5Res = await fetch(`/api/jobs/${jobId}/gp5`);
            if (!gp5Res.ok) throw new Error("GP5 下载失败");
            const buf = await gp5Res.arrayBuffer();
            if (cancelled) return;
            setGp5Data(new Uint8Array(buf));
            toast.push({ title: "谱例已就绪", description: "你可以开始编辑或导出。", variant: "success" });
          } catch (e) {
            if (cancelled) return;
            setError("无法加载吉他谱数据。");
          }
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
    <section className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide">
          {result?.practiceData && (
            <button
              type="button"
              className={`relative pb-3 text-base font-semibold transition-colors whitespace-nowrap ${
                viewMode === "practice" ? "text-[color:var(--primary)]" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setViewMode("practice")}
            >
              跟弹模式
              {viewMode === "practice" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[color:var(--primary)]" />
              )}
            </button>
          )}
          <button
            type="button"
            className={`relative pb-3 text-base font-semibold transition-colors whitespace-nowrap ${
              viewMode === "full" ? "text-[color:var(--primary)]" : "text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setViewMode("full")}
          >
            专业谱面
            {viewMode === "full" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[color:var(--primary)]" />
            )}
          </button>
        </div>

        <div className="relative flex items-center gap-3 pb-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            返回
          </Link>
          <button
            type="button"
            className="rounded-lg bg-[color:var(--primary)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-50"
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
                  if (gp5Data) {
                    const blob = new Blob([gp5Data as unknown as BlobPart], { type: "application/octet-stream" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${safe}.gp5`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                  setDownloadOpen(false);
                }}
              >
                下载 GP5
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
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(2,6,23,0.08)]">
        <div className="flex flex-col gap-3">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {result && gp5Data ? (
            viewMode === "practice" && result.practiceData ? (
              <PracticeMode practiceData={result.practiceData} gp5Data={gp5Data} songTitle={result.title} />
            ) : (
              <AlphaTabViewer
                ref={viewerRef}
                data={gp5Data}
                filename={result.title}
                titleText={result.title}
                keyText={result.key}
                tempoBpm={result.tempo}
                timeSignatureText={result.time_signature}
                arrangementText={result.arrangement}
              />
            )
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
