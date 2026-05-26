import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { aiGetJson, aiPostJson } from "../lib/ai";
import { useSubscription } from "../hooks/useSubscription";

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
    case "queued": return "排队中";
    case "loading": return "读取音频";
    case "demucs": return "音源分离";
    case "hpss": return "HPSS 分离";
    case "analysis": return "和弦/节拍";
    case "lyrics": return "歌词识别";
    case "melody": return "旋律提取";
    case "sections": return "段落检测";
    case "done": return "完成";
    case "failed": return "失败";
    default: return String(s);
  }
}

function getPreviewStep(preview: unknown): string {
  if (!preview || typeof preview !== "object") return "loading";
  const p = preview as Record<string, unknown>;
  return typeof p.step === "string" ? p.step : "loading";
}

type AiPanelProps = {
  onJobCreated?: (jobId: string) => void;
};

export default function AiPanel({ onJobCreated }: AiPanelProps) {
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const { info: sub } = useSubscription();
  const pollTimerRef = useRef<number | null>(null);

  const canPickLocal = useMemo(() => {
    try {
      return typeof window !== "undefined" && typeof window.desktop?.pickAudioFile === "function";
    } catch { return false; }
  }, []);

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [picked, setPicked] = useState<{ path: string; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [preview, setPreview] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    };
    void init();
    return () => { cancelled = true; };
  }, [sb]);

  useEffect(() => {
    return () => { if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current); };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setJob(null);
    setPreview(null);
    setBusy(false);
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const pickFile = useCallback(async () => {
    if (!canPickLocal) {
      setError("请在桌面端应用窗口中操作");
      return;
    }
    reset();
    const r = await window.desktop?.pickAudioFile?.();
    if (!r) return;
    setPicked(r);
    if (!title) setTitle(r.name);
  }, [canPickLocal, reset, title]);

  const previewStep = useMemo(() => getPreviewStep(preview), [preview]);

  const pollJob = useCallback(async (jobId: string) => {
    if (!userId) return;
    try {
      const latest = await aiGetJson<JobResponse>(`/jobs/${jobId}`, { "x-user-id": userId });
      setJob(latest);
      setPreview(latest.preview ?? null);
      if (latest.status === "succeeded") {
        onJobCreated?.(latest.id);
        reset();
        return;
      }
      if (latest.status === "failed") {
        setError(latest.error || "处理失败");
        return;
      }
      pollTimerRef.current = window.setTimeout(() => void pollJob(jobId), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取状态失败");
    }
  }, [userId, onJobCreated, reset]);

  const startLocalJob = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      if (!userId) throw new Error("请先登录");
      const result = await aiPostJson<JobResponse>(
        "/jobs",
        { audio_path: picked.path, title: (title || picked.name).trim() },
        { "x-user-id": userId }
      );
      setJob(result);
      setPreview(result.preview ?? null);
      void pollJob(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建任务失败");
    } finally {
      setBusy(false);
    }
  };

  const startUrlJob = async () => {
    if (!urlValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (!userId) throw new Error("请先登录");
      const result = await aiPostJson<JobResponse>(
        "/jobs",
        { audio_path: urlValue.trim(), title: (title || "网络音源").trim(), storage_provider: "url" },
        { "x-user-id": userId }
      );
      setJob(result);
      setPreview(result.preview ?? null);
      void pollJob(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建任务失败");
    } finally {
      setBusy(false);
    }
  };

  const isProcessing = busy || job?.status === "processing" || job?.status === "queued";

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="p-3 border-b border-zinc-800 flex flex-col gap-3 overflow-y-auto flex-1">

        {userId && (
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span className="tracking-wider">
              本月 {sub.usedQuota}/{sub.totalQuota}
            </span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-emerald-500/60" style={{ width: `${Math.min(100, (sub.usedQuota / Math.max(1, sub.totalQuota)) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-0 rounded bg-zinc-800 p-0.5">
          <button type="button" onClick={() => setUploadMode("file")} disabled={isProcessing}
            className={`flex-1 py-1 text-[11px] tracking-wider rounded ${uploadMode === "file" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
            本地音频
          </button>
          <button type="button" onClick={() => setUploadMode("url")} disabled={isProcessing}
            className={`flex-1 py-1 text-[11px] tracking-wider rounded ${uploadMode === "url" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
            在线音源
          </button>
        </div>

        {uploadMode === "file" ? (
          <button
            type="button"
            onClick={() => void pickFile()}
            disabled={isProcessing}
            className="w-full rounded border border-dashed border-zinc-700 bg-zinc-800/50 px-3 py-6 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
          >
            {picked ? (
              <div className="truncate">
                <div className="text-zinc-300">{picked.name}</div>
                <div className="text-[10px] text-zinc-600 mt-1 truncate">{picked.path}</div>
              </div>
            ) : (
              <div>点击选择音频文件 {!canPickLocal ? "(仅桌面端)" : ""}</div>
            )}
          </button>
        ) : (
          <input
            type="text"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="YouTube / Bilibili 链接..."
            disabled={isProcessing}
            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          disabled={isProcessing}
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
        />

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{error}</div>
        )}

        <button
          type="button"
          onClick={() => void (uploadMode === "file" ? startLocalJob() : startUrlJob())}
          disabled={(uploadMode === "file" ? !picked : !urlValue.trim()) || busy || job?.status === "processing" || job?.status === "queued"}
          className="w-full rounded bg-emerald-600 py-2.5 text-xs tracking-widest text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "提交中..." : job ? "重新生成" : "开始生成"}
        </button>

        {job && (
          <button type="button" onClick={reset} disabled={busy || job?.status === "processing" || job?.status === "queued"}
            className="w-full rounded border border-zinc-700 py-2 text-[11px] tracking-wider text-zinc-500 hover:text-zinc-300 disabled:opacity-30">
            重置
          </button>
        )}

        {job && (
          <div className="rounded bg-zinc-800/50 border border-zinc-700 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">{stepLabel(previewStep)}</span>
              <span className="text-zinc-600 font-mono">{job.status}</span>
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 truncate">{job.message || ""}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
              <div className="h-full bg-emerald-500/60" style={{ width: `${Math.max(0, Math.min(100, Number(job.progress || 0)))}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
