import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isAdminEmail } from "../lib/admin";

type TeachingSongRow = {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  status: string | null;
  created_at: string;
};

export default function AdminTeachingListPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<TeachingSongRow[]>([]);
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
        .from("teaching_songs")
        .select("id,slug,title,artist,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data || []) as TeachingSongRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [sb, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (slug: string, id: string) => {
    if (!userId) return;
    const ok = window.confirm("确认删除该教学歌曲？（会同时清理本地教学文件）");
    if (!ok) return;
    try {
      const { error } = await sb.from("teaching_songs").delete().eq("id", id);
      if (error) throw error;
      await window.desktop?.teachingDeleteSong?.(slug).catch(() => {});
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  if (email && !isAdminEmail(email)) {
    return (
      <main className="bg-paper-100 py-10">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-paper-300 bg-white p-6 text-sm text-ink-700/70">你不是管理員，無法進入教學管理。</div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-widest text-ink-900">教學管理</h1>
            <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">本地教學檔案會存到 App 資料夾（userData/teaching）。</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-4 py-2 text-sm tracking-widest text-paper-50"
              onClick={() => navigate("/admin/teaching/new")}
            >
              新增
            </button>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-paper-300 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_140px_240px] gap-0 border-b border-paper-300 bg-paper-50 px-5 py-3 text-xs tracking-widest text-ink-700/60">
            <div>歌曲</div>
            <div>狀態</div>
            <div className="text-right">操作</div>
          </div>
          {rows.length ? (
            rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_140px_240px] items-center gap-0 border-b border-paper-300 px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-sm tracking-widest text-ink-900">{(r.title || "").trim() || r.slug}</div>
                  <div className="mt-1 text-xs text-ink-700/60">{r.artist || ""}</div>
                  <div className="mt-1 text-xs font-mono text-ink-700/60 truncate">{r.slug}</div>
                </div>
                <div className="text-xs font-mono text-ink-700/70">{r.status || "-"}</div>
                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/admin/teaching/${encodeURIComponent(r.id)}`}
                    className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs tracking-widest text-ink-900"
                  >
                    編輯
                  </Link>
                  <Link
                    to={`/learn/${encodeURIComponent(r.slug)}/warmup`}
                    className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs tracking-widest text-ink-900"
                  >
                    預覽
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs tracking-widest text-red-600"
                    onClick={() => void remove(r.slug, r.id)}
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-sm text-ink-700/70">{loading ? "加载中…" : "暂无教學歌曲。點右上角「新增」開始。"}</div>
          )}
        </div>
      </div>
    </main>
  );
}
