import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  progress: number | null;
  created_at: string;
};

const PAGE_SIZE = 12;
type SortType = "created_at_desc" | "created_at_asc" | "title_asc" | "title_desc";

function sortLabel(s: SortType) {
  switch (s) {
    case "created_at_desc": return "最新";
    case "created_at_asc": return "最早";
    case "title_asc": return "A-Z";
    case "title_desc": return "Z-A";
  }
}

type TabsPanelProps = { onSelectTab?: (jobId: string) => void };

export default function TabsPanel({ onSelectTab }: TabsPanelProps) {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortType>("created_at_desc");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const load = useCallback(async (p: number, s: string, so: SortType) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      let col = "created_at";
      let ascending = false;
      if (so === "created_at_asc") { ascending = true; }
      else if (so === "title_asc") { col = "title"; ascending = true; }
      else if (so === "title_desc") { col = "title"; ascending = false; }

      let query = sb
        .from("ai_jobs")
        .select("id,title,status,progress,created_at", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "succeeded")
        .order(col, { ascending })
        .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
      if (s) query = query.ilike("title", `%${s}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      setJobs((data || []) as JobRow[]);
      setTotal(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)));
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [sb, userId]);

  useEffect(() => { if (userId) void load(page, search, sort); }, [userId, page, search, sort, load]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { setSearch(value.trim()); setPage(1); }, 400);
  };

  const remove = async (jobId: string) => {
    if (!userId) return;
    if (!window.confirm("确认删除？此操作不可撤销。")) return;
    try {
      const { error } = await sb.from("ai_jobs").delete().eq("id", jobId).eq("user_id", userId);
      if (error) throw error;
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="p-3 border-b border-zinc-800 flex flex-col gap-2">
        <div className="relative">
          <input
            type="text" value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜索..."
            className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-1.5 pl-8 text-xs text-zinc-200 tracking-wider placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-1">
          {(["created_at_desc", "created_at_asc", "title_asc", "title_desc"] as const).map((s) => (
            <button key={s} type="button" onClick={() => { setSort(s); setPage(1); }}
              className={`px-2 py-0.5 text-[10px] tracking-wider rounded ${
                sort === s ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {sortLabel(s)}
            </button>
          ))}
        </div>
        {total > 0 && (
          <div className="text-[10px] text-zinc-600 tracking-wider">
            共 {total} 首 · 第 {page}/{totalPages} 页
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-3 text-[11px] text-red-400 bg-red-400/10 border-b border-red-400/20">{error}</div>}
        {loading && jobs.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500">加载中…</div>
        ) : jobs.length === 0 ? (
          <div className="p-4 text-xs text-zinc-600">{search ? "无匹配结果" : "暂无曲谱"}</div>
        ) : (
          jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => onSelectTab?.(j.id)}
              className="w-full text-left px-3 py-2 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors group flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-300 tracking-wider truncate">{(j.title || "").trim() || "未命名"}</div>
                <div className="text-[10px] text-zinc-600 font-mono mt-0.5">{new Date(j.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <span onClick={(e) => { e.stopPropagation(); navigate(`/editor/${j.id}`); }}
                  className="text-[10px] px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700">编辑</span>
                <span onClick={(e) => { e.stopPropagation(); void remove(j.id); }}
                  className="text-[10px] px-1.5 py-0.5 rounded text-red-400 hover:text-red-300 hover:bg-red-400/10">删除</span>
              </div>
            </button>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 p-2 border-t border-zinc-800">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30">←</button>
          <span className="text-[10px] text-zinc-600">{page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  );
}
