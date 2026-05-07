import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { aiGetJson, aiPostJson } from "../lib/ai";
import { useToast } from "../components/ToastProvider";
import TimelineViewer, { type VisualizationPayload } from "../components/TimelineViewer";

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  message?: string | null;
  error?: string | null;
  preview?: unknown;
};

export default function PlayPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const toast = useToast();
  const audioElRef = useRef<HTMLAudioElement | null>(null);
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
      if (!data.user) navigate("/login", { replace: true });
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb, navigate]);

  const pickFile = useCallback(async () => {
    setError(null);
    setJob(null);
    setPreview(null);
    setAudioSrc(null);
    setAudioTime(0);
    setAudioDuration(0);
    const r = await window.desktop?.pickAudioFile?.();
    if (!r) return;
    setPicked(r);
    setTitle(r.name);
    const src = `file://${encodeURI(r.path)}`;
    setAudioSrc(src);
  }, []);

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
      toast.push({ title: "已开始生成", description: "正在打开编辑页…", variant: "success" });
      navigate(`/editor/${job.id}`, { replace: true });
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
      toast.push({ title: "已开始生成", description: "正在打开编辑页…", variant: "success" });
      navigate(`/editor/${job.id}`, { replace: true });
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
        <h1 className="text-2xl font-serif tracking-widest text-ink-900">生成</h1>
        <div className="mt-8 rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-4 border-b border-paper-300 pb-2">
              <button
                type="button"
                className={`text-sm tracking-widest pb-1 border-b-2 ${uploadMode === "file" ? "border-retro-green text-retro-green" : "border-transparent text-ink-700"}`}
                onClick={() => setUploadMode("file")}
              >
                本地音频
              </button>
              <button
                type="button"
                className={`text-sm tracking-widest pb-1 border-b-2 ${uploadMode === "url" ? "border-retro-green text-retro-green" : "border-transparent text-ink-700"}`}
                onClick={() => setUploadMode("url")}
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
                  >
                    选择文件
                  </button>
                </div>
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
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">标题（可选）</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900"
              />
            </div>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            <button
              type="button"
              onClick={() => void (uploadMode === "file" ? startLocalJob() : startUrlJob())}
              disabled={(uploadMode === "file" ? !picked : !urlValue.trim()) || busy}
              className="inline-flex items-center justify-center rounded-lg bg-retro-green px-6 py-3 text-sm tracking-widest text-paper-50 disabled:opacity-50"
            >
              {busy ? "生成中..." : "开始生成"}
            </button>

            {viz ? (
              <TimelineViewer viz={viz} currentTime={audioTime} durationSec={audioDuration} onSeek={onSeek} />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
