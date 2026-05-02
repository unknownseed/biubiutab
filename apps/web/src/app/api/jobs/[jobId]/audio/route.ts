import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "original";

  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) return Response.json({ detail: "job not found" }, { status: 404 });

  // 1. 先去 Supabase 查一下这个 job，看它是不是用的 r2
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ detail: "unauthorized" }, { status: 401 });

  const { data: dbJob, error: dbError } = await sb
    .from("ai_jobs")
    .select("id,user_id,audio_path,storage_provider,preview")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();
  if (dbError || !dbJob) return Response.json({ detail: "job not found" }, { status: 404 });
  
  if (dbJob?.preview?.storage_provider === "r2" || dbJob?.storage_provider === "r2" || dbJob?.audio_path?.startsWith("uploads/")) {
    let publicDomain = process.env.CLOUDFLARE_PUBLIC_DOMAIN;
    if (!publicDomain) {
      return Response.json({ detail: "CLOUDFLARE_PUBLIC_DOMAIN not configured" }, { status: 500 });
    }
    // Remove trailing slash if user added it
    publicDomain = publicDomain.replace(/\/$/, "");
    
    // 原声
    if (type === "original") {
      const audioPath = dbJob.audio_path; // 例如: uploads/xxx.mp3
      return Response.redirect(`${publicDomain}/${audioPath}`);
    } 
    // 2. 如果是无伴奏
    else if (type === "no_vocals") {
      const stemPath = `stems/${jobId}/no_vocals.mp3`;
      return Response.redirect(`${publicDomain}/${stemPath}`);
    }
    return Response.json({ detail: "invalid type" }, { status: 400 });
  }

  // 2. 如果不是 r2 (或者是以前的旧数据)，就 fallback 到本地磁盘读取逻辑
  let filePath = "";
  if (type === "original") {
    const uploadsDir = path.join(repoRoot(), "storage", "uploads");
    try {
      const files = await readdir(uploadsDir);
      const match = files.find(f => f.startsWith(jobId + "."));
      if (!match) return Response.json({ detail: "job not found" }, { status: 404 });
      filePath = path.join(uploadsDir, match);
    } catch {
      return Response.json({ detail: "job not found" }, { status: 404 });
    }
  } else if (type === "no_vocals") {
    filePath = path.join(repoRoot(), "storage", "stems", jobId, "no_vocals.wav");
  } else {
    return Response.json({ detail: "invalid type" }, { status: 400 });
  }

  try {
    const s = await stat(filePath);
    const stream = createReadStream(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".wav" ? "audio/wav" : ext === ".mp3" ? "audio/mpeg" : "application/octet-stream";
    
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": String(s.size),
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ detail: "job not found" }, { status: 404 });
  }
}
