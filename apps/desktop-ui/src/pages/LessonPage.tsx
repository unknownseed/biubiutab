import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isAdminEmail } from "../lib/admin";
import LessonNav from "../components/teaching/LessonNav";
import PracticeBlock, { type PracticeBlockData } from "../components/teaching/PracticeBlock";

type SongManifest = {
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  core_chords?: string[];
};

const manifestModules = import.meta.glob("../teaching/songs/**/manifest.json", { eager: true, import: "default" }) as Record<string, SongManifest>;
const moduleModules = import.meta.glob("../teaching/songs/**/{warmup,basic,advanced,solo}.json", { eager: true, import: "default" }) as Record<string, any>;

function keyForManifest(slug: string) {
  return Object.keys(manifestModules).find((p) => p.endsWith(`/teaching/songs/${slug}/manifest.json`)) || null;
}

function keyForModule(slug: string, module: string) {
  return Object.keys(moduleModules).find((p) => p.endsWith(`/teaching/songs/${slug}/${module}.json`)) || null;
}

function availableModulesForSlug(slug: string) {
  const all = ["warmup", "basic", "advanced", "solo"];
  return all.filter((m) => Boolean(keyForModule(slug, m)));
}

function normalizeBlocks(module: string, data: any): PracticeBlockData[] {
  if (!data || typeof data !== "object") return [];
  const out: PracticeBlockData[] = [];

  if (module === "warmup") {
    if (Array.isArray(data.chord_switches)) {
      for (const x of data.chord_switches) {
        out.push({ title: x?.title || "和弦转换", gp5Url: x?.gp5_url, tempo: x?.tempo });
      }
    }
    if (Array.isArray(data.rhythm_patterns)) {
      for (const x of data.rhythm_patterns) {
        out.push({ title: x?.name || "节奏预习", gp5Url: x?.gp5_url, tempo: x?.tempo });
      }
    }
    if (Array.isArray(data.challenges)) {
      for (const x of data.challenges) {
        out.push({ title: x?.title || "难点", gp5Url: x?.gp5_url, tempo: x?.tempo, tips: x?.tips });
      }
    }
  } else if (module === "basic") {
    if (Array.isArray(data.sections)) {
      for (const x of data.sections) {
        out.push({ title: x?.label || x?.name || "分段练习", gp5Url: x?.gp5_url, tempo: x?.tempo, tips: x?.tips });
      }
    }
  } else if (module === "advanced") {
    if (data.full_song) {
      out.push({ title: "全曲练习", gp5Url: data.full_song?.gp5_url, tempo: data.full_song?.tempo });
    }
    if (Array.isArray(data.challenges)) {
      for (const x of data.challenges) {
        out.push({ title: x?.title || "难点", gp5Url: x?.gp5_url, tempo: x?.tempo, tips: x?.tips });
      }
    }
  } else if (module === "solo") {
    if (data.backing) {
      out.push({ title: "Backtrack", gp5Url: data.backing?.gp5_url, tempo: data.backing?.bpm });
    }
  }

  return out;
}

export default function LessonPage() {
  const params = useParams();
  const slug = params.slug ? String(params.slug) : "";
  const module = params.module ? String(params.module) : "";
  const sb = useMemo(() => supabase(), []);

  const [manifest, setManifest] = useState<SongManifest | null>(null);
  const [moduleData, setModuleData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableModules = useMemo(() => ["warmup", "basic", "advanced", "solo"], []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const loadManifest = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await sb.auth.getUser();
        const email = userData.user?.email ?? null;
        const admin = isAdminEmail(email);
        const q = sb.from("teaching_songs").select("manifest,status,user_id").eq("slug", slug).limit(1);
        const res = admin ? await q.single() : await q.eq("status", "published").single();
        if (cancelled) return;
        if (res.error) throw res.error;
        setManifest((res.data as any)?.manifest || null);
      } catch (e) {
        if (!cancelled) {
          const k = keyForManifest(slug);
          setManifest(k ? manifestModules[k] : null);
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, [sb, slug]);

  useEffect(() => {
    if (!slug || !module) return;
    let cancelled = false;
    const loadModule = async () => {
      setError(null);
      try {
        if (window.desktop?.teachingReadText) {
          const text = await window.desktop.teachingReadText(`songs/${slug}/${module}.json`);
          if (!text.trim()) throw new Error("module empty");
          const obj = JSON.parse(text);
          if (!cancelled) setModuleData(obj);
          return;
        }
        const k = keyForModule(slug, module);
        if (!cancelled) setModuleData(k ? moduleModules[k] : null);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "加载失败";
          if (String(msg).includes("ENOENT") || String(msg).includes("no such file") || String(msg).includes("module empty")) {
            setModuleData(null);
            setError(`教學內容尚未在本機生成：${slug}/${module}。請用管理員帳號到「教學管理」進入該歌曲並點「生成模組」。`);
            return;
          }
          const k = keyForModule(slug, module);
          setModuleData(k ? moduleModules[k] : null);
          setError(msg);
        }
      }
    };
    void loadModule();
    return () => {
      cancelled = true;
    };
  }, [slug, module]);

  const blocks = useMemo(() => normalizeBlocks(module, moduleData), [module, moduleData]);

  if (!slug) return <Navigate to="/learn" replace />;
  if (!availableModules.includes(module)) return <Navigate to={`/learn/${encodeURIComponent(slug)}/warmup`} replace />;

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="mb-6">
          <div className="text-xs tracking-[0.35em] text-ink-700/60">{manifest?.artist || "TEACHING"}</div>
          <h1 className="mt-2 text-2xl font-serif tracking-widest text-ink-900">{manifest?.title || slug}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-700/60">
            {typeof manifest?.bpm === "number" ? <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono">BPM {manifest.bpm}</span> : null}
            {manifest?.key ? <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono">KEY {manifest.key}</span> : null}
            {manifest?.core_chords?.length ? (
              <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono truncate max-w-[420px]">
                {manifest.core_chords.join(" · ")}
              </span>
            ) : null}
          </div>
        </div>

        <LessonNav slug={slug} availableModules={availableModules} />

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 rounded-2xl border border-paper-300 bg-white p-5 text-sm text-ink-700/70">
          {typeof moduleData?.description === "string" ? moduleData.description : module === "warmup" ? "预习模块" : module === "basic" ? "基础模块" : module === "advanced" ? "进阶模块" : module === "solo" ? "Solo 模块" : ""}
        </div>

        <div className="mt-6 space-y-5">
          {blocks.map((b, idx) => (
            <PracticeBlock key={`${idx}-${b.title}`} data={b} coreChords={manifest?.core_chords} />
          ))}
        </div>

        {!blocks.length ? (
          <div className="mt-6 rounded-2xl border border-paper-300 bg-white p-6 text-sm text-ink-700/70">
            {loading ? "加载中…" : "此模組暫無可練習的譜例（請先在「教學管理」生成模組，或確認本地 teaching 檔案存在）。"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
