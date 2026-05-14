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
      if (!data.user) navigate("/login", { replace: true });
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb, navigate]);

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
        const res = await fetch(url, { headers: { "x-user-id": userId } });
        if (!res.ok) throw new Error("GP5 下载失败");
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
  }, [jobId, userId, level]);

  return (
    <main className="min-h-screen bg-paper-100 pt-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-serif tracking-widest text-ink-900">跟练</h1>
          <button
            type="button"
            className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
            onClick={() => navigate(jobId ? `/editor/${jobId}` : "/play")}
          >
            返回
          </button>
        </div>

        {error ? <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {result?.practiceData && gp5 ? (
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
          <div className="mt-8 rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
            <div className="text-sm text-ink-800">正在准备练习模式…</div>
          </div>
        )}
      </div>
    </main>
  );
}
