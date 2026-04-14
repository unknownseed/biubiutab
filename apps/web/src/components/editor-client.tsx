"use client";

import { useEffect, useRef, useState } from "react";

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
  const [viewMode, setViewMode] = useState<"full" | "practice">("full");
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
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(2,6,23,0.08)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-950">谱例</div>
              {result?.practiceData && (
                <div className="ml-4 flex items-center rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "full" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setViewMode("full")}
                  >
                    完整六线谱
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "practice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setViewMode("practice")}
                  >
                    极简跟弹
                  </button>
                </div>
              )}
            </div>
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
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {result && gp5Data ? (
            viewMode === "practice" && result.practiceData ? (
              <PracticeMode practiceData={result.practiceData} gp5Data={gp5Data} />
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
