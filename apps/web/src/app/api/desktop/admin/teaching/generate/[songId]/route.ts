import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

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
  return { sb } as const;
}

export async function POST(req: Request, { params }: { params: Promise<{ songId: string }> }) {
  const auth = await getAuthedSupabase(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { sb } = auth;
  const { songId } = await params;

  const { data: song, error: fetchError } = await sb.from("teaching_songs").select("manifest,slug").eq("id", songId).single();
  if (fetchError || !song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  const slug = song.slug;
  if (!slug) return NextResponse.json({ error: "Song has no slug" }, { status: 400 });

  const songsDir = path.resolve(process.cwd(), "songs", slug);
  if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
  const manifestToWrite = { ...(song.manifest || {}), slug };
  fs.writeFileSync(path.join(songsDir, "manifest.json"), JSON.stringify(manifestToWrite, null, 2));

  const pythonScriptPath = path.resolve(process.cwd(), "../../services/ai/generate_lessons.py");
  const repoRoot = path.resolve(process.cwd(), "../..");

  let stdout = "";
  let stderr = "";
  try {
    const r = await execFileAsync("python3", [pythonScriptPath, slug], { cwd: repoRoot });
    stdout = String(r.stdout || "");
    stderr = String(r.stderr || "");
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Python execution failed: ${msg}` }, { status: 500 });
  }

  const { error: updateError } = await sb.from("teaching_songs").update({ status: "published" }).eq("id", songId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ message: "教学模块生成成功", status: "published", stdout, stderr });
}

