import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import { aiBaseUrl, aiGetJson } from "../lib/ai";
import AlphaTabViewer from "../components/AlphaTabViewer";

const PracticeMode = lazy(() => import("../components/practice/PracticeMode"));

type JobResponse = {
  id: string;
  status: string;
  progress: number;
  title?: string | null;
  message?: string | null;
  error?: string | null;
};

type JobResult = {
  title: string;
  key: string;
  tempo: number;
  time_signature: string;
  arrangement: string;
  sections?: { name: string; start_bar: number; end_bar: number; chords?: { chord: string; bar: number; beat: number }[] }[];
  practiceData?: any;
};

type SongManifest = {
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  core_chords?: string[];
};

type MainStageMode = "practice" | "view";

type MainStageProps = {
  jobId: string | null;
  lessonSlug: string | null;
};

function useJobLoader(jobId: string | null, level: number) {
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [gp5, setGp5] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!jobId || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setGp5(null);
    setJob(null);
    setResult(null);

    const load = async () => {
      try {
        const [jobData, resultData] = await Promise.all([
          aiGetJson<JobResponse>(`/jobs/${jobId}`, { "x-user-id": userId }),
          aiGetJson<JobResult>(`/jobs/${jobId}/result`, { "x-user-id": userId }),
        ]);
        if (cancelled) return;
        setJob(jobData);
        setResult(resultData);

        const gp5Url = `${aiBaseUrl()}/jobs/${jobId}/result.gp5?level=${level}`;
        const gp5Res = await fetch(gp5Url, { headers: { "x-user-id": userId } });
        if (!gp5Res.ok) throw new Error("GP5 下载失败");
        const buf = await gp5Res.arrayBuffer();
        if (cancelled) return;
        setGp5(new Uint8Array(buf));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [jobId, userId, level]);

  return { job, result, gp5, error, loading, userId };
}

const manifestModules = import.meta.glob("../teaching/songs/**/manifest.json", { eager: true, import: "default" }) as Record<string, SongManifest>;

function getLessonManifest(slug: string): { manifest: SongManifest; fullSlug: string } | null {
  const parts = slug.split("/");
  const baseSlug = parts[0];
  const module = parts[1] || null;
  const key = Object.keys(manifestModules).find((p) => p.endsWith(`/teaching/songs/${baseSlug}/manifest.json`)) || null;
  if (!key) return null;
  return { manifest: manifestModules[key], fullSlug: module ? `${baseSlug}/${module}` : baseSlug };
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <svg className="mx-auto mb-4 w-12 h-12 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <p className="text-zinc-600 text-xs tracking-widest">从左侧面板选择曲谱或教学</p>
        <p className="text-zinc-700 text-[10px] mt-1 tracking-wider">AI · Tabs · Learn · Admin</p>
      </div>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-zinc-500 text-xs tracking-widest font-mono animate-pulse">{text}</div>
    </div>
  );
}

function ErrorState({ error, jobId }: { error: string; jobId?: string | null }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-xs tracking-widest">{error}</p>
        {jobId && <p className="text-zinc-600 text-[10px] mt-2 tracking-wider">{jobId.slice(0, 8)}…</p>}
      </div>
    </div>
  );
}

function LessonPreview({ lessonSlug }: { lessonSlug: string }) {
  const info = getLessonManifest(lessonSlug);
  if (!info) return <ErrorState error="无法加载教学资料" />;
  const { manifest } = info;
  const parts = lessonSlug.split("/");
  const moduleName = parts.length > 1 ? parts[1] : null;
  const modules = ["warmup", "basic", "advanced", "solo"] as const;
  const moduleLabels: Record<string, string> = { warmup: "预習", basic: "基礎", advanced: "進階", solo: "Solo" };

  const handleModuleClick = (m: string) => {
    const baseSlug = parts[0];
    const url = `/learn/${encodeURIComponent(baseSlug)}/${m}`;
    window.location.href = url;
  };

  return (
    <div className="flex flex-col flex-1 h-full gap-0">
      <div className="h-[80px] bg-zinc-900 border-b border-zinc-800 flex items-center px-4 shrink-0 gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-300 tracking-wider truncate">{manifest.title || parts[0]}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-zinc-500">{manifest.artist || "—"}</span>
            {typeof manifest.bpm === "number" && <span className="text-[10px] text-zinc-500 font-mono">BPM {manifest.bpm}</span>}
            {manifest.key && <span className="text-[10px] text-zinc-500 font-mono">Key {manifest.key}</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[#fafafa] overflow-auto">
        <div className="h-full flex flex-col items-center justify-center gap-6">
          <svg className="w-16 h-16 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75">
            <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <div className="text-center">
            <p className="text-zinc-500 text-xs tracking-widest">{manifest.title || parts[0]}</p>
            <p className="text-zinc-600 text-[10px] mt-1 tracking-wider">{manifest.artist ? `${manifest.artist} 教学` : "教学课程"}</p>
          </div>
          {manifest.core_chords?.length ? (
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {manifest.core_chords.map((c: string, i: number) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded bg-zinc-100 text-zinc-700 font-mono tracking-wider border border-zinc-200">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {modules.map((m) => {
              const active = moduleName === m;
              return (
                <button key={m} type="button" onClick={() => handleModuleClick(m)}
                  className={`px-4 py-2 text-xs tracking-wider rounded border transition-colors ${
                    active ? "bg-emerald-600 text-white border-emerald-500" : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                  }`}>
                  {moduleLabels[m]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabViewPreview({
  job, result, gp5, jobId, level, onModeChange, onLevelChange,
}: {
  job: JobResponse;
  result: JobResult;
  gp5: Uint8Array | null;
  jobId: string;
  level: number;
  onModeChange: () => void;
  onLevelChange: (l: number) => void;
}) {
  const sections = result?.sections || [];
  const chordBlocks = sections.flatMap((s) =>
    (s.chords || []).map((c) => ({ chord: c.chord, bar: c.bar, beat: c.beat, section: s.name }))
  );

  const levels = [
    { id: 1, label: "启蒙" },
    { id: 2, label: "小白" },
    { id: 3, label: "初级" },
    { id: 4, label: "中级" },
  ];

  return (
    <div className="flex flex-col flex-1 h-full gap-0">
      <div className="h-[80px] bg-zinc-900 border-b border-zinc-800 flex items-center px-4 shrink-0 gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-300 tracking-wider truncate">{result?.title || job?.title || "未命名"}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-zinc-500 font-mono">BPM {result?.tempo || "—"}</span>
            <span className="text-[10px] text-zinc-500 font-mono">Key {result?.key || "—"}</span>
            <span className="text-[10px] text-zinc-500 font-mono">{result?.time_signature || "4/4"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded bg-zinc-800 p-0.5 mr-2">
            {levels.map((l) => (
              <button key={l.id} type="button" onClick={() => { onLevelChange(l.id); }}
                className={`px-2 py-0.5 text-[10px] tracking-wider rounded ${level === l.id ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onModeChange}
            className="px-3 py-1.5 text-[10px] tracking-wider rounded bg-emerald-600 text-white hover:bg-emerald-500">
            ▶ 切到跟练
          </button>
          {sections.map((s, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 tracking-wider border border-zinc-700/50">
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#fafafa] overflow-auto">
        {gp5 ? (
          <div className="p-4">
            <AlphaTabViewer data={gp5} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-400 text-xs tracking-widest">无法加载谱面</p>
          </div>
        )}
      </div>

      {chordBlocks.length > 0 && (
        <div className="h-[64px] bg-zinc-900 border-t border-zinc-800 flex items-center px-4 shrink-0 overflow-x-auto gap-2">
          {chordBlocks.slice(0, 32).map((c, i) => (
            <span key={i} className="shrink-0 text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 font-mono tracking-wider border border-zinc-700/50">
              {c.chord}
            </span>
          ))}
          {chordBlocks.length > 32 && (
            <span className="text-[10px] text-zinc-600">+{chordBlocks.length - 32} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function TabPracticeInline({
  result, gp5, jobId, userId, level, onLevelChange, onBack,
}: {
  result: JobResult;
  gp5: Uint8Array | null;
  jobId: string;
  userId: string;
  level: number;
  onLevelChange: (l: number) => void;
  onBack: () => void;
}) {
  if (!result.practiceData || !gp5) {
    return (
      <div className="flex flex-col flex-1 h-full gap-0">
        <div className="h-[80px] bg-zinc-900 border-b border-zinc-800 flex items-center px-4 shrink-0">
          <button type="button" onClick={onBack} className="px-3 py-1 text-[10px] tracking-wider rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200">
            切到谱例
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xs">此曲谱缺少练习数据，切换到谱例查看</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full gap-0 overflow-hidden">
      <div className="h-[48px] bg-zinc-900 border-b border-zinc-800 flex items-center px-4 shrink-0 gap-4">
        <button type="button" onClick={onBack} className="px-3 py-1 text-[10px] tracking-wider rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500">
          切到谱例
        </button>
        <span className="text-xs text-zinc-400 tracking-wider truncate">{result.title || "跟练"}</span>
      </div>
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500 text-xs">加载练习模式…</div>}>
          <PracticeMode
            practiceData={result.practiceData}
            gp5Data={gp5}
            songTitle={result.title}
            jobId={jobId}
            userId={userId}
            level={level}
            onLevelChange={onLevelChange}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function MainStage({ jobId, lessonSlug }: MainStageProps) {
  const [mode, setMode] = useState<MainStageMode>("practice");
  const [level, setLevel] = useState(4);

  const { job, result, gp5, error, loading, userId } = useJobLoader(jobId, level);

  useEffect(() => {
    setMode("practice");
    setLevel(4);
  }, [jobId, lessonSlug]);

  if (!jobId && !lessonSlug) return <EmptyState />;

  if (lessonSlug) return <LessonPreview lessonSlug={lessonSlug} />;

  if (loading) return <LoadingState text="加载中…" />;
  if (error) return <ErrorState error={error} jobId={jobId} />;
  if (!job || !result) return <LoadingState text="加载任务…" />;

  if (mode === "practice" && userId) {
    return (
      <TabPracticeInline
        result={result}
        gp5={gp5}
        jobId={jobId!}
        userId={userId}
        level={level}
        onLevelChange={setLevel}
        onBack={() => setMode("view")}
      />
    );
  }

  return (
    <TabViewPreview
      job={job}
      result={result}
      gp5={gp5}
      jobId={jobId!}
      level={level}
      onModeChange={() => setMode("practice")}
      onLevelChange={setLevel}
    />
  );
}
