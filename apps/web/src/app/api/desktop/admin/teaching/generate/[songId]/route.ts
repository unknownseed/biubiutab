import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "node:os";
import { execFile } from "child_process";
import { promisify } from "util";
import { createClient } from "@supabase/supabase-js";
import { repoRoot } from "@/lib/paths";
import { r2Enabled, r2GetObjectBuffer, r2PutObject } from "@/lib/r2";
import { TeachingModuleName, putTeachingModuleJson, teachingR2KeyGp5, teachingR2KeyPrefix, teachingR2KeySourceBaseGp5 } from "@/lib/teaching-r2";

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

  const root = repoRoot();
  const pythonScriptPath = path.resolve(root, "services/ai/generate_lessons.py");
  const enabled = r2Enabled();
  const tmpRoot = path.join(os.tmpdir(), "biubiutab-teaching", `${slug}-${Date.now()}`);
  const songsRoot = path.join(tmpRoot, "songs");
  const publicRoot = path.join(tmpRoot, "public");
  const songDir = path.join(songsRoot, slug);

  if (enabled) {
    fs.mkdirSync(songDir, { recursive: true });
    fs.mkdirSync(publicRoot, { recursive: true });
    const baseBuf = await r2GetObjectBuffer(teachingR2KeySourceBaseGp5(slug)).catch(() => null);
    if (!baseBuf) return NextResponse.json({ error: "Missing base.gp5 in R2, please upload it first." }, { status: 400 });
    fs.writeFileSync(path.join(songDir, "base.gp5"), baseBuf);
    const manifestToWrite = { ...(song.manifest || {}), slug };
    fs.writeFileSync(path.join(songDir, "manifest.json"), JSON.stringify(manifestToWrite, null, 2));
  } else {
    const legacySongsDir = path.resolve(process.cwd(), "songs", slug);
    if (!fs.existsSync(legacySongsDir)) fs.mkdirSync(legacySongsDir, { recursive: true });
    const manifestToWrite = { ...(song.manifest || {}), slug };
    fs.writeFileSync(path.join(legacySongsDir, "manifest.json"), JSON.stringify(manifestToWrite, null, 2));
  }

  let stdout = "";
  let stderr = "";
  try {
    const r = await execFileAsync("python3", [pythonScriptPath, slug], {
      cwd: root,
      env: enabled ? { ...process.env, BIUBIU_TEACHING_SONGS_DIR: songsRoot, BIUBIU_TEACHING_PUBLIC_DIR: publicRoot } : process.env,
    });
    stdout = String(r.stdout || "");
    stderr = String(r.stderr || "");
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Python execution failed: ${msg}` }, { status: 500 });
  }

  try {
    if (enabled) {
      const mods: TeachingModuleName[] = ["warmup", "basic", "advanced", "solo"];
      for (const mod of mods) {
        const jsonPath = path.join(songDir, `${mod}.json`);
        if (!fs.existsSync(jsonPath)) return NextResponse.json({ error: `Generated module missing: ${mod}.json` }, { status: 500 });
        const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        await putTeachingModuleJson(slug, mod, parsed);
      }

      for (const mod of ["warmup", "basic", "advanced", "solo"] as const) {
        const filename = `${mod}.gp5`;
        const gp5Path = path.join(publicRoot, "gp5", slug, filename);
        if (!fs.existsSync(gp5Path)) return NextResponse.json({ error: `Generated gp5 missing: ${filename}` }, { status: 500 });
        const bytes = fs.readFileSync(gp5Path);
        await r2PutObject(teachingR2KeyGp5(slug, filename), bytes, "application/octet-stream");
      }

      const manifestKey = `${teachingR2KeyPrefix(slug)}/manifest.json`;
      const manifestToWrite = { ...(song.manifest || {}), slug };
      await r2PutObject(manifestKey, Buffer.from(JSON.stringify(manifestToWrite), "utf8"), "application/json; charset=utf-8");
    }
  } finally {
    if (enabled) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {}
    }
  }

  const { error: updateError } = await sb.from("teaching_songs").update({ status: "published" }).eq("id", songId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ message: "教学模块生成成功", status: "published", stdout, stderr });
}
