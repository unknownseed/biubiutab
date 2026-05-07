import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { aiPostJson } from "../lib/ai";

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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fp = (file as any)?.path as string | undefined;
      if (!fp) {
        throw new Error("未检测到本地文件路径。请在桌面端应用中使用本功能。");
      }
      if (!userId) throw new Error("请先登录");
      const job = await aiPostJson<JobResponse>(
        "/jobs",
        { audio_path: fp, title: title || file.name },
        { "x-user-id": userId }
      );
      navigate(`/editor/${job.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建任务失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper-100 pt-10">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="text-2xl font-serif tracking-widest text-ink-900">生成</h1>
        <div className="mt-8 rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1">选择音频文件（本地）</label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </div>
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
              onClick={() => void start()}
              disabled={!file || busy}
              className="inline-flex items-center justify-center rounded-lg bg-retro-green px-6 py-3 text-sm tracking-widest text-paper-50 disabled:opacity-50"
            >
              {busy ? "生成中..." : "开始生成"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

