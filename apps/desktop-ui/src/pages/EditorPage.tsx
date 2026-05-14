import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { aiBaseUrl, aiGetJson } from "../lib/ai";
import AlphaTabViewer from "../components/AlphaTabViewer";

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  title?: string | null;
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
  key: string;
  tempo: number;
  time_signature: string;
  arrangement: string;
  sections: Section[];
  alphatex: string;
  metadata?: Record<string, unknown> | null;
};

function safeFilename(name: string): string {
  const trimmed = (name || "").trim() || "score";
  return trimmed.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
}

export default function EditorPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(4);
  const [gp5, setGp5] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      if (!data.user) navigate("/login", { replace: true });
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb, navigate]);

  useEffect(() => {
    if (!jobId || !userId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const latest = await aiGetJson<JobResponse>(`/jobs/${jobId}`, { "x-user-id": userId });
        if (cancelled) return;
        setJob(latest);
        if (latest.status === "failed") {
          setError(latest.error || "处理失败");
          return;
        }
        if (latest.status === "succeeded") return;
        window.setTimeout(() => void poll(), 800);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "请求失败");
        window.setTimeout(() => void poll(), 1200);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, userId]);

  useEffect(() => {
    if (!jobId || !userId) return;
    if (job?.status !== "succeeded") return;
    let cancelled = false;
    const fetchGp5 = async () => {
      try {
        const url = `${aiBaseUrl()}/jobs/${jobId}/result.gp5?level=${level}`;
        const res = await fetch(url, { headers: { "x-user-id": userId } });
        if (!res.ok) throw new Error("GP5 下载失败");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        setGp5(new Uint8Array(buf));
      } catch (e) {
        if (cancelled) return;
        setGp5(null);
        setError(e instanceof Error ? e.message : "GP5 下载失败");
      }
    };
    void fetchGp5();
    return () => {
      cancelled = true;
    };
  }, [job?.status, jobId, level, userId]);

  useEffect(() => {
    if (!jobId || !userId) return;
    if (job?.status !== "succeeded") return;
    let cancelled = false;
    const fetchResult = async () => {
      try {
        const r = await aiGetJson<JobResult>(`/jobs/${jobId}/result`, { "x-user-id": userId });
        if (cancelled) return;
        setResult(r);
      } catch (e) {
        if (cancelled) return;
        setResult(null);
      }
    };
    void fetchResult();
    return () => {
      cancelled = true;
    };
  }, [job?.status, jobId, userId]);

  const download = async () => {
    if (!jobId) return;
    const url = `${aiBaseUrl()}/jobs/${jobId}/result.gp5?level=${level}`;
    const res = await fetch(url, { headers: userId ? { "x-user-id": userId } : undefined });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "下载失败");
    }
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = safeFilename(result?.title || job?.title || "tab");
    a.download = `${base}.gp5`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  return (
    <main className="min-h-screen bg-paper-100 pt-10">
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-serif tracking-widest text-ink-900">编辑</h1>
          <button
            type="button"
            className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
            onClick={() => navigate("/play")}
          >
            返回
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          <div className="mt-2 flex flex-col gap-2">
            <div className="text-sm text-ink-800">状态：{job?.status || "-"}</div>
            <div className="text-sm text-ink-800">进度：{typeof job?.progress === "number" ? `${job.progress}%` : "-"}</div>
            <div className="text-sm text-ink-700/70">{job?.message || ""}</div>
          </div>

          {result ? (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-paper-300 bg-paper-50 p-4 text-sm">
              <div className="col-span-2 font-serif tracking-widest text-ink-900">{result.title}</div>
              <div className="text-ink-800">调性：{result.key}</div>
              <div className="text-ink-800">速度：{result.tempo} BPM</div>
              <div className="text-ink-800">拍号：{result.time_signature}</div>
              <div className="text-ink-800">编配：{result.arrangement}</div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm"
              disabled={job?.status !== "succeeded"}
            >
              <option value={1}>Level 1</option>
              <option value={2}>Level 2</option>
              <option value={3}>Level 3</option>
              <option value={4}>Level 4</option>
            </select>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-5 py-2 text-sm tracking-widest text-paper-50 disabled:opacity-50"
              disabled={job?.status !== "succeeded"}
              onClick={() => void download().catch((e) => setError(e instanceof Error ? e.message : "下载失败"))}
            >
              下载 GP5
            </button>
            <button
              type="button"
              className="rounded-lg border border-paper-300 bg-white px-5 py-2 text-sm tracking-widest text-ink-900 disabled:opacity-50"
              disabled={job?.status !== "succeeded" || !jobId}
              onClick={() => navigate(`/practice/${jobId}`)}
            >
              进入跟练
            </button>
          </div>

          {gp5 ? (
            <div className="mt-8 rounded-xl border border-paper-300 bg-paper-50 p-4">
              <AlphaTabViewer data={gp5} />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
