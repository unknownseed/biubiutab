import { createClient } from "@/lib/supabase/server";
import { r2PublicDomain } from "@/lib/r2";
import { teachingR2KeyMedia } from "@/lib/teaching-r2";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

function safeSlug(v: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(v)) return null;
  return v;
}

function safeFilename(v: string): string | null {
  if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return null;
  return v;
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; filename: string }> }) {
  const { slug: rawSlug, filename: rawFilename } = await ctx.params;
  const slug = safeSlug(rawSlug);
  const filename = safeFilename(rawFilename);
  if (!slug || !filename) return Response.json({ error: "not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: song } = await supabase
    .from("teaching_songs")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (!song) return Response.json({ error: "not found" }, { status: 404 });

  const publicDomain = r2PublicDomain();
  if (publicDomain) {
    return Response.redirect(`${publicDomain}/${teachingR2KeyMedia(slug, filename)}`);
  }

  const localPath = path.resolve(process.cwd(), "public", "media", slug, filename);
  if (!fs.existsSync(localPath)) return Response.json({ error: "not found" }, { status: 404 });
  const bytes = fs.readFileSync(localPath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === ".mp4" ? "video/mp4" : ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "application/octet-stream";
  return new Response(bytes, { status: 200, headers: { "content-type": contentType } });
}

