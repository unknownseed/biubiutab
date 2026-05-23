import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSubscription } from "../hooks/useSubscription";

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
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
  const { info: sub } = useSubscription();

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

      if (s) {
        query = query.ilike("title", `%${s}%`);
      }

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

  useEffect(() => {
    if (userId) void load(page, search, sort);
  }, [userId, page, search, sort, load]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 400);
  };

  const handleSortChange = (newSort: SortType) => {
    setSort(newSort);
    setPage(1);
  };

  const remove = async (jobId: string) => {
    if (!userId) return;
    const ok = window.confirm("确认删除该曲谱记录？此操作不可撤销。");
    if (!ok) return;
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
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-serif tracking-widest text-ink-900">我的曲譜</h1>
            <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">
              {email ? `帳號：${email}` : ""}
              {sub.isPro && <span className="ml-2 rounded-md bg-retro-green/10 border border-retro-green/20 px-2 py-0.5 text-xs tracking-wider text-retro-green">Pro</span>}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
            onClick={() => { setPage(1); void load(1, search, sort); }}
            disabled={loading}
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索曲谱标题..."
              className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 pl-10 text-sm text-ink-900 tracking-wider placeholder:text-ink-700/40 focus:outline-none focus:border-retro-green/50"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-700/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-700/50 tracking-widest mr-1">排序：</span>
            {(["created_at_desc", "created_at_asc", "title_asc", "title_desc"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSortChange(s)}
                className={`px-3 py-1.5 text-xs tracking-widest rounded-lg border transition-colors ${
                  sort === s
                    ? "bg-retro-green text-paper-50 border-retro-green"
                    : "border-paper-300 bg-white text-ink-700 hover:border-retro-green/30"
                }`}
              >
                {sortLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-paper-300 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_140px_220px] gap-0 border-b border-paper-300 bg-paper-50 px-5 py-3 text-xs tracking-widest text-ink-700/60">
            <div>標題</div>
            <div>狀態</div>
            <div className="text-right">操作</div>
          </div>
          {loading && jobs.length === 0 ? (
            <div className="px-5 py-10 text-sm text-ink-700/70">加载中…</div>
          ) : jobs.length ? (
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
            <div className="px-5 py-10 text-sm text-ink-700/70">
              {search ? "未找到匹配曲谱，试试其他关键词？" : "暂无曲谱记录。先去「彈唱」生成一个吧。"}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 text-sm tracking-widest rounded-lg border border-paper-300 bg-white text-ink-700 disabled:opacity-30 hover:border-retro-green/30 transition-colors"
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-10 h-10 text-sm tracking-widest rounded-lg border transition-colors ${
                  p === page
                    ? "bg-retro-green text-paper-50 border-retro-green"
                    : "border-paper-300 bg-white text-ink-700 hover:border-retro-green/30"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 text-sm tracking-widest rounded-lg border border-paper-300 bg-white text-ink-700 disabled:opacity-30 hover:border-retro-green/30 transition-colors"
            >
              下一页
            </button>
          </div>
        )}

        {total > 0 && (
          <div className="mt-4 text-center text-xs text-ink-700/40 tracking-wider">
            共 {total} 首曲谱，第 {page}/{totalPages} 页
          </div>
        )}
      </div>
    </main>
  );
}
