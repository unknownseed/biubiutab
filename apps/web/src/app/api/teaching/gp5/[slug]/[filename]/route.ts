import { createClient } from "@/lib/supabase/server";
import { r2PublicDomain } from "@/lib/r2";
import { teachingR2KeyGp5, getTeachingGp5Buffer } from "@/lib/teaching-r2";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

function safeSlug(v: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(v)) return null;
  return v;
}

function safeFilename(v: string): string | null {
  if (!/^[a-zA-Z0-9_.-]+\.gp5$/.test(v)) return null;
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

  const buf = await getTeachingGp5Buffer(slug, filename);
  if (buf) {
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const publicDomain = r2PublicDomain();
  if (publicDomain) {
    const url = `${publicDomain}/${teachingR2KeyGp5(slug, filename)}`;
    const fileRes = await fetch(url);
    if (fileRes.ok) {
      return new Response(fileRes.body, {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  const localPath = path.resolve(process.cwd(), "public", "gp5", slug, filename);
  if (!fs.existsSync(localPath)) return Response.json({ error: "not found" }, { status: 404 });
  const bytes = fs.readFileSync(localPath);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
