import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function AdminPanel() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<TeachingSongRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setEmail(data.user?.email ?? null);
    };
    void init();
    return () => { cancelled = true; };
  }, [sb]);

  const load = useCallback(async () => {
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
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (slug: string, id: string) => {
    if (!window.confirm("确认删除该教学歌曲？")) return;
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
      <div className="flex flex-col h-full bg-zinc-900">
        <div className="p-4 text-xs text-zinc-500">你不是管理员</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-[10px] text-zinc-500 tracking-wider">教学管理</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void load()} disabled={loading}
            className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            {loading ? "刷新中" : "刷新"}
          </button>
          <button type="button" onClick={() => navigate("/admin/teaching/new")}
            className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500">
            新增
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-3 text-[11px] text-red-400 bg-red-400/10 border-b border-red-400/20">{error}</div>}
        {loading && rows.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500">加载中…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-xs text-zinc-600">暂无教学歌曲</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="border-b border-zinc-800/50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-300 tracking-wider truncate">{(r.title || "").trim() || r.slug}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{r.artist || "—"} · {r.slug}</div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                  r.status === "published" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}>
                  {r.status || "draft"}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <button type="button" onClick={() => navigate(`/admin/teaching/${encodeURIComponent(r.id)}`)}
                  className="text-[10px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                  编辑
                </button>
                <button type="button" onClick={() => navigate(`/learn/${encodeURIComponent(r.slug)}/warmup`)}
                  className="text-[10px] px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                  预览
                </button>
                <button type="button" onClick={() => void remove(r.slug, r.id)}
                  className="text-[10px] px-2 py-0.5 rounded text-red-400 hover:text-red-300 hover:bg-red-400/10">
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
