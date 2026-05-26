import { useEffect, useMemo, useState } from "react";
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

type LearnPanelProps = { onSelectSong?: (slug: string) => void };

export default function LearnPanel({ onSelectSong }: LearnPanelProps) {
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
        if (!cancelled) { setSongs(localFallback); setError(e instanceof Error ? e.message : "加载失败"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sb, localFallback]);

  const modules = ["warmup", "basic", "advanced", "solo"] as const;
  const moduleLabels: Record<string, string> = { warmup: "預習", basic: "基礎", advanced: "進階", solo: "Solo" };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="p-3 border-b border-zinc-800">
        <div className="text-xs tracking-widest text-zinc-400 font-mono">教學曲目</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-3 text-[11px] text-red-400 bg-red-400/10 border-b border-red-400/20">{error}</div>}
        {loading && songs.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500">加载中…</div>
        ) : songs.length === 0 ? (
          <div className="p-4 text-xs text-zinc-600">暂无教学资料</div>
        ) : (
          songs.map(({ slug, manifest }) => (
            <div key={slug} className="border-b border-zinc-800/50">
              <button
                type="button"
                onClick={() => onSelectSong?.(slug)}
                className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="text-xs text-zinc-300 tracking-wider font-medium">{manifest.title || slug}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {manifest.artist ? `${manifest.artist} · ` : ""}
                  {typeof manifest.bpm === "number" ? `BPM ${manifest.bpm} ` : ""}
                  {manifest.key ? `Key ${manifest.key}` : ""}
                </div>
                {manifest.core_chords?.length ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {manifest.core_chords.map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{c}</span>
                    ))}
                  </div>
                ) : null}
              </button>
              <div className="flex gap-0.5 px-3 pb-2">
                {modules.map((m) => (
                  <span key={m}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 tracking-wider cursor-pointer hover:bg-zinc-700 hover:text-zinc-300"
                    onClick={() => onSelectSong?.(`${slug}/${m}`)}
                  >
                    {moduleLabels[m] || m}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
