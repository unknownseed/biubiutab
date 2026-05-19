import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isAdminEmail } from "../lib/admin";

type TeachingSongRow = {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  status: string | null;
  manifest: any;
};

function safeJsonStringify(v: unknown) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function AdminTeachingEditPage() {
  const params = useParams();
  const songId = String(params.songId || "new");
  const isNew = songId === "new";
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [row, setRow] = useState<TeachingSongRow | null>(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [manifestText, setManifestText] = useState("{}");

  const [baseGp5Path, setBaseGp5Path] = useState<string | null>(null);
  const [demoAudioPath, setDemoAudioPath] = useState<string | null>(null);
  const [demoVideoPath, setDemoVideoPath] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [genOutput, setGenOutput] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    if (isNew) {
      setRow(null);
      setTitle("");
      setArtist("");
      setSlug("");
      setStatus("draft");
      setManifestText("{}");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setError(null);
      try {
        const { data, error } = await sb.from("teaching_songs").select("*").eq("id", songId).single();
        if (cancelled) return;
        if (error) throw error;
        const r = data as TeachingSongRow;
        setRow(r);
        setTitle(r.title || "");
        setArtist(r.artist || "");
        setSlug(r.slug || "");
        setStatus((r.status === "published" ? "published" : "draft") as any);
        setManifestText(safeJsonStringify(r.manifest));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载失败");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sb, songId, userId, isNew]);

  if (email && !isAdminEmail(email)) {
    return (
      <main className="bg-paper-100 py-10">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-paper-300 bg-white p-6 text-sm text-ink-700/70">你不是管理員，無法進入教學管理。</div>
        </div>
      </main>
    );
  }

  const pick = async (kind: "gp5" | "audio" | "video") => {
    const f = await window.desktop?.pickTeachingFile?.(kind);
    if (!f) return;
    if (kind === "gp5") setBaseGp5Path(f.path);
    if (kind === "audio") setDemoAudioPath(f.path);
    if (kind === "video") setDemoVideoPath(f.path);
  };

  const save = async () => {
    if (!userId) return;
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }
    if (!slug.trim()) {
      setError("slug 不能为空");
      return;
    }
    if (!window.desktop?.teachingWriteManifest || !window.desktop?.teachingSaveAsset) {
      setError("当前环境不支持本地教学文件操作，请在 Electron 桌面端运行。");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setGenOutput(null);
    try {
      let manifestObj: any;
      try {
        manifestObj = JSON.parse(manifestText || "{}");
      } catch {
        throw new Error("manifest 不是合法 JSON");
      }
      if (!manifestObj || typeof manifestObj !== "object") throw new Error("manifest 必须是 JSON 对象");

      manifestObj.slug = slug.trim();
      manifestObj.title = title.trim();
      if (artist.trim()) manifestObj.artist = artist.trim();
      if (!manifestObj.source_files || typeof manifestObj.source_files !== "object") manifestObj.source_files = {};

      if (baseGp5Path) {
        const r = await window.desktop.teachingSaveAsset(slug.trim(), "base_gp5", baseGp5Path);
        manifestObj.source_files.base_gp5 = r.baseGp5Name || "base.gp5";
      } else if (!manifestObj.source_files.base_gp5) {
        manifestObj.source_files.base_gp5 = "base.gp5";
      }

      if (demoAudioPath) {
        const r = await window.desktop.teachingSaveAsset(slug.trim(), "demo_audio", demoAudioPath);
        if (r.publicUrl) manifestObj.source_files.full_audio = r.publicUrl;
      }

      if (demoVideoPath) {
        const r = await window.desktop.teachingSaveAsset(slug.trim(), "demo_video", demoVideoPath);
        if (r.publicUrl) manifestObj.source_files.full_video = r.publicUrl;
      }

      const finalManifestText = safeJsonStringify(manifestObj);
      await window.desktop.teachingWriteManifest(slug.trim(), finalManifestText);
      setManifestText(finalManifestText);

      if (isNew) {
        const { data, error } = await sb
          .from("teaching_songs")
          .insert({ user_id: userId, slug: slug.trim(), title: title.trim(), artist: artist.trim() || null, status, manifest: manifestObj })
          .select("id")
          .single();
        if (error) throw error;
        setNotice("已保存");
        navigate(`/admin/teaching/${data.id}`, { replace: true });
        return;
      }

      const { error } = await sb
        .from("teaching_songs")
        .update({ slug: slug.trim(), title: title.trim(), artist: artist.trim() || null, status, manifest: manifestObj })
        .eq("id", songId)
        ;
      if (error) throw error;
      setNotice("已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!userId) return;
    if (!slug.trim()) {
      setError("请先填写 slug 并保存");
      return;
    }
    if (!window.desktop?.teachingGenerateLessons) {
      setError("当前环境不支持生成教學模組，请在 Electron 桌面端运行。");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setGenOutput(null);
    try {
      const r = await window.desktop.teachingGenerateLessons(slug.trim());
      setGenOutput(r.output || "");
      if (!r.ok) throw new Error("生成失败（请查看输出）");
      const targetId = row?.id || songId;
      const { error } = await sb.from("teaching_songs").update({ status: "published" }).eq("id", targetId);
      if (error) throw error;
      setStatus("published");
      setNotice("已生成并发布");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-widest text-ink-900">{isNew ? "新增教學歌曲" : "編輯教學歌曲"}</h1>
            <div className="mt-2 text-xs font-mono text-ink-700/60">{row?.id ? `id: ${row.id}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900"
              onClick={() => navigate("/admin/teaching")}
            >
              返回
            </button>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-4 py-2 text-sm tracking-widest text-paper-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "处理中..." : "保存"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm tracking-widest text-ink-900 disabled:opacity-50"
              disabled={busy || !slug.trim()}
              onClick={() => void generate()}
            >
              生成模組
            </button>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">标题</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">歌手</label>
                <input value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-800 mb-1">status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900">
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-medium text-ink-800">文件</div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs tracking-widest text-ink-700/70">base.gp5</div>
                    <div className="truncate text-xs font-mono text-ink-700/60">{baseGp5Path || ""}</div>
                  </div>
                  <button type="button" className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs tracking-widest" onClick={() => void pick("gp5")}>
                    选择
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs tracking-widest text-ink-700/70">demo audio</div>
                    <div className="truncate text-xs font-mono text-ink-700/60">{demoAudioPath || ""}</div>
                  </div>
                  <button type="button" className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs tracking-widest" onClick={() => void pick("audio")}>
                    选择
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs tracking-widest text-ink-700/70">demo video</div>
                    <div className="truncate text-xs font-mono text-ink-700/60">{demoVideoPath || ""}</div>
                  </div>
                  <button type="button" className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs tracking-widest" onClick={() => void pick("video")}>
                    选择
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-ink-800">manifest.json</div>
              <button
                type="button"
                className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs tracking-widest text-ink-900"
                onClick={() => navigate(`/learn/${encodeURIComponent(slug || row?.slug || "")}/warmup`)}
                disabled={!slug.trim() && !(row?.slug || "").trim()}
              >
                預覽
              </button>
            </div>
            <textarea
              value={manifestText}
              onChange={(e) => setManifestText(e.target.value)}
              className="mt-3 h-[520px] w-full resize-none rounded-lg border border-paper-300 bg-white px-3 py-2 text-xs font-mono text-ink-900"
            />
          </div>
        </div>

        {genOutput ? (
          <div className="mt-6 rounded-2xl border border-paper-300 bg-white p-5">
            <div className="text-sm font-medium text-ink-800">生成輸出</div>
            <pre className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-paper-300 bg-paper-50 p-3 text-xs text-ink-900 whitespace-pre-wrap">
              {genOutput}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}
