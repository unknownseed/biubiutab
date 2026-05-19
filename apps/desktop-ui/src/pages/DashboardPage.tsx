import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  progress: number | null;
  created_at: string;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      if (!data.user) navigate("/login", { replace: true });
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb, navigate]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await sb
        .from("ai_jobs")
        .select("id,title,status,progress,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setJobs((data || []) as JobRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [sb, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (jobId: string) => {
    if (!userId) return;
    const ok = window.confirm("确认删除该曲谱记录？此操作不可撤销。");
    if (!ok) return;
    try {
      const { error } = await sb.from("ai_jobs").delete().eq("id", jobId).eq("user_id", userId);
      if (error) throw error;
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-widest text-ink-900">我的曲譜</h1>
            <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">{email ? `帳號：${email}` : ""}</div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-paper-300 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_140px_220px] gap-0 border-b border-paper-300 bg-paper-50 px-5 py-3 text-xs tracking-widest text-ink-700/60">
            <div>標題</div>
            <div>狀態</div>
            <div className="text-right">操作</div>
          </div>
          {jobs.length ? (
            jobs.map((j) => (
              <div key={j.id} className="grid grid-cols-[1fr_140px_220px] items-center gap-0 border-b border-paper-300 px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-sm tracking-widest text-ink-900">{(j.title || "").trim() || "未命名"}</div>
                  <div className="mt-1 text-xs text-ink-700/60 font-mono truncate">{j.id}</div>
                </div>
                <div className="text-xs font-mono text-ink-700/70">
                  {j.status}
                  {typeof j.progress === "number" ? ` ${j.progress}%` : ""}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-retro-green px-3 py-2 text-xs tracking-widest text-paper-50"
                    onClick={() => navigate(`/editor/${j.id}`)}
                  >
                    打開
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs tracking-widest text-ink-900"
                    onClick={() => navigate(`/practice/${j.id}`)}
                  >
                    跟練
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs tracking-widest text-red-600"
                    onClick={() => void remove(j.id)}
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-sm text-ink-700/70">{loading ? "加载中…" : "暂无曲谱记录。先去「彈唱」生成一个吧。"}</div>
          )}
        </div>
      </div>
    </main>
  );
}

