import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type SongManifest = {
  slug?: string;
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  core_chords?: string[];
};

const manifestModules = import.meta.glob("../teaching/songs/**/manifest.json", { eager: true, import: "default" }) as Record<string, SongManifest>;

function toSlug(p: string) {
  const m = /\/teaching\/songs\/([^/]+)\/manifest\.json$/.exec(p);
  return m ? m[1] : p;
}

export default function LearnPage() {
  const sb = useMemo(() => supabase(), []);
  const [songs, setSongs] = useState<{ slug: string; manifest: SongManifest }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const localFallback = useMemo(() => {
    const list = Object.entries(manifestModules).map(([path, manifest]) => ({ slug: manifest.slug || toSlug(path), manifest }));
    list.sort((a, b) => (a.manifest.title || a.slug).localeCompare(b.manifest.title || b.slug, "zh-Hans-CN"));
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await sb
          .from("teaching_songs")
          .select("slug,manifest,status")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        const list = (data || []).map((r: any) => ({ slug: String(r.slug), manifest: (r.manifest || {}) as SongManifest }));
        if (!cancelled) setSongs(list.length ? list : localFallback);
      } catch (e) {
        if (!cancelled) {
          setSongs(localFallback);
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sb, localFallback]);

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-serif tracking-widest text-ink-900">BiuBiu 教學</h1>
          <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">選擇歌曲 → 進入模組 → 載入譜例開始練習</div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-5 md:grid-cols-2">
          {songs.map(({ slug, manifest }) => (
            <Link
              key={slug}
              to={`/learn/${encodeURIComponent(slug)}/warmup`}
              className="rounded-2xl border border-paper-300 bg-white p-6 shadow-sm transition-colors hover:bg-paper-50"
            >
              <div className="text-xs tracking-[0.35em] text-ink-700/60">{manifest.artist || "TEACHING"}</div>
              <div className="mt-2 text-xl font-serif tracking-widest text-ink-900">{manifest.title || slug}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-700/60">
                {typeof manifest.bpm === "number" ? <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono">BPM {manifest.bpm}</span> : null}
                {manifest.key ? <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono">KEY {manifest.key}</span> : null}
                {manifest.core_chords?.length ? (
                  <span className="rounded-md border border-paper-300 bg-paper-50 px-2 py-1 font-mono truncate max-w-[260px]">
                    {manifest.core_chords.join(" · ")}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        {!songs.length ? (
          <div className="mt-6 rounded-2xl border border-paper-300 bg-white p-6 text-sm text-ink-700/70">{loading ? "加载中…" : "未找到教學資料。"}</div>
        ) : null}
      </div>
    </main>
  );
}
