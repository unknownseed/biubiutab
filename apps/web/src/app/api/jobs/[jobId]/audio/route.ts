import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "original";

  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) return new Response("not found", { status: 404 });

  let filePath = "";
  if (type === "original") {
    const uploadsDir = path.join(repoRoot(), "storage", "uploads");
    try {
      const files = await readdir(uploadsDir);
      const match = files.find(f => f.startsWith(jobId + "."));
      if (!match) return new Response("not found", { status: 404 });
      filePath = path.join(uploadsDir, match);
    } catch {
      return new Response("not found", { status: 404 });
    }
  } else if (type === "no_vocals") {
    filePath = path.join(repoRoot(), "storage", "stems", jobId, "no_vocals.wav");
  } else {
    return new Response("invalid type", { status: 400 });
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
    return new Response("not found", { status: 404 });
  }
}
