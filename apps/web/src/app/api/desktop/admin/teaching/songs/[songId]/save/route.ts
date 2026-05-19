import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

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
  const { data: isAdmin, error: adminErr } = await sb.rpc("is_admin");
  if (adminErr || !isAdmin) return { error: "Forbidden", status: 403 as const };
  return { sb, user: data.user, token } as const;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function writeUploadedFile(file: File, destPath: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, buf);
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

  const songsDir = path.resolve(process.cwd(), "songs", slug);
  ensureDir(songsDir);

  if (baseGp5File && baseGp5File.size > 0) {
    await writeUploadedFile(baseGp5File, path.join(songsDir, "base.gp5"));
    manifest.source_files.base_gp5 = "base.gp5";
  } else if (!manifest.source_files.base_gp5) {
    manifest.source_files.base_gp5 = "base.gp5";
  }

  const publicMediaDir = path.resolve(process.cwd(), "public", "media", slug);
  if (videoFile && videoFile.size > 0) {
    const ext = (videoFile.name.split(".").pop() || "mp4").trim() || "mp4";
    const fileName = `demo_video.${ext}`;
    await writeUploadedFile(videoFile, path.join(publicMediaDir, fileName));
    manifest.source_files.full_video = `/media/${slug}/${fileName}`;
  }

  if (audioFile && audioFile.size > 0) {
    const ext = (audioFile.name.split(".").pop() || "mp3").trim() || "mp3";
    const fileName = `demo_audio.${ext}`;
    await writeUploadedFile(audioFile, path.join(publicMediaDir, fileName));
    manifest.source_files.full_audio = `/media/${slug}/${fileName}`;
  }

  fs.writeFileSync(path.join(songsDir, "manifest.json"), JSON.stringify(manifest, null, 2));

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

