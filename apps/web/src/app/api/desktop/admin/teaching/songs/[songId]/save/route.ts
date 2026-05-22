import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2Enabled, r2PutObject } from "@/lib/r2";
import { teachingR2KeyMedia, teachingR2KeySourceBaseGp5 } from "@/lib/teaching-r2";
import { isAdmin as checkIsAdmin } from "@/lib/admin-rpc";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

async function getAuthedSupabase(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { error: "Unauthorized", status: 401 as const };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized", status: 401 as const };
  if (!(await checkIsAdmin(sb, data.user.id, data.user.email))) return { error: "Forbidden", status: 403 as const };
  return { sb, user: data.user, token } as const;
}

async function fileToBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(req: Request, { params }: { params: Promise<{ songId: string }> }) {
  const auth = await getAuthedSupabase(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { sb, user } = auth;
  const { songId } = await params;

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const slug = String(form.get("slug") || "").trim();
  const artist = String(form.get("artist") || "").trim();
  const status = String(form.get("status") || "draft").trim() || "draft";
  const manifestRaw = String(form.get("manifest") || "{}");
  const baseGp5File = form.get("base_gp5") as File | null;
  const audioFile = form.get("demo_audio") as File | null;
  const videoFile = form.get("demo_video") as File | null;

  if (!title || !slug) return NextResponse.json({ error: "标题和 Slug 不能为空" }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return NextResponse.json({ error: "Slug 只能包含字母、数字、下划线或短横线" }, { status: 400 });

  let manifest: any;
  try {
    manifest = manifestRaw ? JSON.parse(manifestRaw) : {};
  } catch {
    return NextResponse.json({ error: "Manifest 格式不正确，必须是有效的 JSON" }, { status: 400 });
  }

  if (!manifest || typeof manifest !== "object") manifest = {};
  manifest.slug = slug;
  manifest.title = title;
  if (artist) manifest.artist = artist;
  if (!manifest.source_files || typeof manifest.source_files !== "object") manifest.source_files = {};
  const enabled = r2Enabled();

  if (baseGp5File && baseGp5File.size > 0) {
    if (!enabled) return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });
    const buf = await fileToBuffer(baseGp5File);
    if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
      return NextResponse.json({ error: "不支持 GPX 格式，请在 Guitar Pro 中用「文件 → 导出 → Guitar Pro 5 (.gp5)」重新导出后上传。" }, { status: 400 });
    }
    await r2PutObject(teachingR2KeySourceBaseGp5(slug), buf, baseGp5File.type || "application/octet-stream");
    manifest.source_files.base_gp5 = "base.gp5";
  } else if (!manifest.source_files.base_gp5) {
    manifest.source_files.base_gp5 = "base.gp5";
  }

  if (videoFile && videoFile.size > 0) {
    if (!enabled) return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });
    const ext = (videoFile.name.split(".").pop() || "mp4").trim() || "mp4";
    const fileName = `demo_video.${ext}`;
    await r2PutObject(teachingR2KeyMedia(slug, fileName), await fileToBuffer(videoFile), videoFile.type || "video/mp4");
    manifest.source_files.full_video = `/api/teaching/media/${slug}/${fileName}`;
  }

  if (audioFile && audioFile.size > 0) {
    if (!enabled) return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });
    const ext = (audioFile.name.split(".").pop() || "mp3").trim() || "mp3";
    const fileName = `demo_audio.${ext}`;
    await r2PutObject(teachingR2KeyMedia(slug, fileName), await fileToBuffer(audioFile), audioFile.type || "audio/mpeg");
    manifest.source_files.full_audio = `/api/teaching/media/${slug}/${fileName}`;
  }

  const payload = { title, slug, artist: artist || null, status, manifest, user_id: user.id };
  if (songId === "new") {
    const { data, error } = await sb.from("teaching_songs").insert([payload]).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, slug, status, message: "saved" });
  }

  const { error } = await sb.from("teaching_songs").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", songId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: songId, slug, status, message: "saved" });
}
