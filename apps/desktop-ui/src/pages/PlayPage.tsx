import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { aiGetJson, aiPostJson } from "../lib/ai";
import { useToast } from "../components/ToastProvider";
import { useSubscription } from "../hooks/useSubscription";
import TimelineViewer, { type VisualizationPayload } from "../components/TimelineViewer";

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  message?: string | null;
  error?: string | null;
  preview?: unknown;
};

type PreviewStep =
  | "queued"
  | "loading"
  | "demucs"
  | "hpss"
  | "analysis"
  | "lyrics"
  | "melody"
  | "sections"
  | "done"
  | "failed";

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

export default function PlayPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const { info: sub } = useSubscription();
  const toast = useToast();
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const canPickLocal = useMemo(() => {
    try {
      return typeof window !== "undefined" && typeof window.desktop?.pickAudioFile === "function";
    } catch {
      return false;
    }
  }, []);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [picked, setPicked] = useState<{ path: string; name: string } | null>(null);
  const [title, setTitle] = useState<string>("");
  const [urlValue, setUrlValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
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
      toast.push({ title: "无法选择本地文件", description: "请在桌面端应用窗口中操作（Electron）。浏览器无法获取本地文件路径。", variant: "warning" });
      return;
    }
    reset();
    setAudioSrc(null);
    setAudioTime(0);
    setAudioDuration(0);
    const r = await window.desktop?.pickAudioFile?.();
    if (!r) return;
    setPicked(r);
    setTitle(r.name);
    const src = `file://${encodeURI(r.path)}`;
    setAudioSrc(src);
  }, [canPickLocal, reset, toast]);

  const viz = useMemo(() => {
    if (!preview || typeof preview !== "object") return null;
    const p = preview as Record<string, unknown>;
    const out: VisualizationPayload = {};
    if (p.waveform && typeof p.waveform === "object") {
      const w = p.waveform as Record<string, unknown>;
      if (typeof w.duration_sec === "number" && Array.isArray(w.peaks)) {
        out.waveform = { duration_sec: w.duration_sec, peaks: w.peaks as number[] };
      }
    }
    if (Array.isArray(p.beats)) out.beats = p.beats as number[];
    if (Array.isArray(p.bars)) out.bars = p.bars as any;
    if (Array.isArray(p.lyrics_segments)) out.lyrics_segments = p.lyrics_segments as any;
    return Object.keys(out).length ? out : null;
  }, [preview]);

  const previewStep = useMemo(() => getPreviewStep(preview), [preview]);

  const pollJob = useCallback(
    async (jobId: string) => {
      if (!userId) return;
      try {
        const latest = await aiGetJson<JobResponse>(`/jobs/${jobId}`, { "x-user-id": userId });
        setJob(latest);
        setPreview(latest.preview ?? null);
        if (latest.status === "succeeded") {
          toast.push({ title: "生成完成", description: "谱面已就绪，正在打开编辑页。", variant: "success" });
          navigate(`/editor/${latest.id}`, { replace: true });
          return;
        }
        if (latest.status === "failed") {
          const msg = latest.error || "处理失败";
          setError(msg);
          toast.push({ title: "生成失败", description: msg, variant: "error" });
          return;
        }
        pollTimerRef.current = window.setTimeout(() => void pollJob(jobId), 900);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "获取状态失败";
        setError(msg);
        toast.push({ title: "请求失败", description: msg, variant: "error" });
      }
    },
    [navigate, toast, userId]
  );

  const startLocalJob = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      if (!userId) throw new Error("请先登录");
      const fp = picked.path;
      const job = await aiPostJson<JobResponse>(
        "/jobs",
        { audio_path: fp, title: (title || picked.name).trim() },
        { "x-user-id": userId }
      );
      setJob(job);
      setPreview(job.preview ?? null);
      toast.push({ title: "已开始生成", description: "正在生成谱面，请稍候…", variant: "success" });
      void pollJob(job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建任务失败";
      setError(msg);
      toast.push({ title: "创建失败", description: msg, variant: "error" });
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
      const job = await aiPostJson<JobResponse>(
        "/jobs",
        { audio_path: urlValue.trim(), title: (title || "网络音源").trim(), storage_provider: "url" },
        { "x-user-id": userId }
      );
      setJob(job);
      setPreview(job.preview ?? null);
      toast.push({ title: "已开始生成", description: "正在生成谱面，请稍候…", variant: "success" });
      void pollJob(job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建任务失败";
      setError(msg);
      toast.push({ title: "创建失败", description: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onTime = () => setAudioTime(el.currentTime || 0);
    const onDur = () => setAudioDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
    };
  }, [audioSrc]);

  const onSeek = useCallback((t: number) => {
    const el = audioElRef.current;
    if (!el || !Number.isFinite(t)) return;
    el.currentTime = t;
    void el.play().catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-paper-100 pt-10">
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-serif tracking-widest text-ink-900">生成</h1>
          <div className="mt-2 text-sm text-ink-700/60 font-light tracking-wider">
            选择一段音频，本地 AI 会把流动的声音凝固成谱面。
          </div>
        </div>

        {userId ? (
          <div className="mb-6 rounded-2xl border border-paper-300 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {sub.isPro ? (
                  <span className="rounded-md bg-retro-green/10 border border-retro-green/20 px-3 py-1 text-sm font-serif tracking-wider text-retro-green">Pro</span>
                ) : (
                  <span className="rounded-md bg-paper-200 border border-paper-300 px-3 py-1 text-sm font-serif tracking-wider text-ink-700/60">Free</span>
                )}
                <div className="text-sm text-ink-700/70">
                  本月已用 <span className="font-semibold text-ink-900">{sub.usedQuota}</span> / <span className="font-semibold text-ink-900">{sub.totalQuota}</span> 次
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-700/50">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-paper-200">
                  <div
                    className="h-full bg-wood-400 transition-all"
                    style={{ width: `${Math.min(100, (sub.usedQuota / Math.max(1, sub.totalQuota)) * 100)}%` }}
                  />
                </div>
                {sub.usedQuota >= sub.totalQuota && !sub.isPro ? (
                  <button
                    type="button"
                    className="text-retro-green hover:underline"
                    onClick={() => window.open("http://localhost:3000/pricing", "_blank")}
                  >
                    升级 Pro
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {!userId ? (
          <div className="mt-8 rounded-2xl border border-retro-green/20 bg-retro-green/5 p-10 text-center">
            <div className="text-3xl mb-4">🎸</div>
            <h2 className="text-xl font-serif tracking-widest text-ink-900 mb-3">登入后解锁 AI 制谱</h2>
            <p className="text-sm text-ink-700/70 mb-6 leading-relaxed max-w-sm mx-auto">
              登录后可使用本地 AI 自动生成吉他谱 —— 每月免费 3 次，Pro 会员 100 次。
            </p>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-8 py-3 text-sm tracking-widest text-paper-50"
              onClick={() => navigate("/login")}
            >
              登入 / 注册
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
            <div className="space-y-4">
            <div className="flex items-center gap-4 border-b border-paper-300 pb-2">
              <button
                type="button"
                className={`text-sm tracking-widest pb-1 border-b-2 ${uploadMode === "file" ? "border-retro-green text-retro-green" : "border-transparent text-ink-700"}`}
                onClick={() => setUploadMode("file")}
                disabled={busy || (job?.status === "processing" || job?.status === "queued")}
              >
                本地音频
              </button>
              <button
                type="button"
                className={`text-sm tracking-widest pb-1 border-b-2 ${uploadMode === "url" ? "border-retro-green text-retro-green" : "border-transparent text-ink-700"}`}
                onClick={() => setUploadMode("url")}
                disabled={busy || (job?.status === "processing" || job?.status === "queued")}
              >
                在线音频
              </button>
            </div>

            {uploadMode === "file" ? (
              <div className="rounded-xl border border-dashed border-paper-300 bg-paper-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-ink-900 truncate">{picked?.name || "未选择文件"}</div>
                    <div className="text-xs text-ink-700/60">{picked?.path || ""}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
                    onClick={() => void pickFile()}
                    disabled={busy || (job?.status === "processing" || job?.status === "queued")}
                  >
                    选择文件
                  </button>
                </div>
                {!canPickLocal ? (
                  <div className="mt-3 text-xs text-ink-700/60">
                    提示：此页面若在浏览器中打开，将无法选择本地文件。请使用桌面端应用窗口。
                  </div>
                ) : null}
                {audioSrc ? (
                  <audio ref={audioElRef} className="mt-4 w-full" src={audioSrc} controls preload="metadata" />
                ) : null}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">音频/视频链接</label>
                <input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900"
                  placeholder="https://"
                  disabled={busy || (job?.status === "processing" || job?.status === "queued")}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">标题（可选）</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900"
                disabled={busy || (job?.status === "processing" || job?.status === "queued")}
              />
            </div>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void (uploadMode === "file" ? startLocalJob() : startUrlJob())}
                disabled={(uploadMode === "file" ? !picked : !urlValue.trim()) || busy || job?.status === "processing" || job?.status === "queued"}
                className="inline-flex items-center justify-center rounded-lg bg-retro-green px-6 py-3 text-sm tracking-widest text-paper-50 disabled:opacity-50"
              >
                {busy ? "生成中..." : job ? "重新生成" : "开始生成"}
              </button>
              {job ? (
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center justify-center rounded-lg border border-paper-300 bg-white px-6 py-3 text-sm tracking-widest text-ink-900"
                  disabled={busy || job?.status === "processing" || job?.status === "queued"}
                >
                  重置
                </button>
              ) : null}
            </div>

            {job ? (
              <div className="rounded-xl border border-paper-300 bg-paper-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-ink-900">
                      {stepLabel(previewStep)} · {typeof job.progress === "number" ? `${job.progress}%` : "-"}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-700/70 truncate">{job.message || ""}</div>
                  </div>
                  <div className="text-xs text-ink-700/50">{job.status}</div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-200">
                  <div
                    className="h-full bg-wood-400"
                    style={{ width: `${Math.max(0, Math.min(100, Number(job.progress || 0)))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {viz ? (
              <TimelineViewer viz={viz} currentTime={audioTime} durationSec={audioDuration} onSeek={onSeek} />
            ) : null}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
