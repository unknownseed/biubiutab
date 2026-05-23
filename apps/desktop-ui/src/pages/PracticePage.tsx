import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { aiBaseUrl, aiGetJson } from "../lib/ai";
import PracticeMode from "../components/practice/PracticeMode";

type JobResult = {
  title: string;
  key: string;
  tempo: number;
  time_signature: string;
  arrangement: string;
  practiceData?: any;
};

export default function PracticePage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [gp5, setGp5] = useState<Uint8Array | null>(null);
  const [level, setLevel] = useState(4);

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
    if (!jobId || !userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await aiGetJson<JobResult>(`/jobs/${jobId}/result`, { "x-user-id": userId });
        if (cancelled) return;
        setResult(r);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载失败");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId, userId]);

  useEffect(() => {
    if (!jobId || !userId) return;
    let cancelled = false;
    const fetchGp5 = async () => {
      try {
        const url = `${aiBaseUrl()}/jobs/${jobId}/result.gp5?level=${level}`;
        let res = await fetch(url, { headers: { "x-user-id": userId } });
        if (!res.ok) {
          const { data: sess } = await sb.auth.getSession();
          const token = sess.session?.access_token;
          if (token) {
            const fallbackUrl = `${(import.meta as any).env?.VITE_WEB_BASE_URL?.replace(/\/+$/, "") || "http://localhost:3000"}/api/jobs/${jobId}/gp5?level=${level}`;
            const fbRes = await fetch(fallbackUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!fbRes.ok) throw new Error("GP5 下载失败");
            res = fbRes;
          } else {
            throw new Error("GP5 下载失败");
          }
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        setGp5(new Uint8Array(buf));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "GP5 下载失败");
      }
    };
    void fetchGp5();
    return () => {
      cancelled = true;
    };
  }, [jobId, userId, level, sb]);

  return (
    <main className="min-h-screen bg-zinc-950 pt-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-serif tracking-widest text-zinc-100">跟练</h1>
          <button
            type="button"
            className="rounded-none border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm tracking-widest text-zinc-300 hover:bg-zinc-800"
            onClick={() => navigate(jobId ? `/editor/${jobId}` : "/play")}
          >
            返回
          </button>
        </div>

        {error ? <div className="mt-6 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        {!userId ? (
          <div className="mt-8 flex flex-col items-center rounded-none border border-zinc-800 bg-zinc-900 p-10 text-center">
            <div className="text-3xl mb-4 text-zinc-400">🎸</div>
            <h2 className="text-xl font-serif tracking-widest text-zinc-100 mb-3">登入后解锁跟练</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed max-w-sm">
              登入后可使用完整的跟练模式 —— 变速练习、和弦提示、歌词同步等。
            </p>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-8 py-3 text-sm tracking-widest text-paper-50"
              onClick={() => navigate("/login")}
            >
              登入 / 注册
            </button>
          </div>
        ) : result?.practiceData && gp5 ? (
          <div className="mt-8">
            <PracticeMode
              practiceData={result.practiceData}
              gp5Data={gp5}
              songTitle={result.title}
              jobId={jobId}
              userId={userId}
              level={level}
              onLevelChange={setLevel}
            />
          </div>
        ) : (
          <div className="mt-8 rounded-none border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
            <div className="text-sm text-zinc-400">正在准备练习模式…</div>
          </div>
        )}
      </div>
    </main>
  );
}
