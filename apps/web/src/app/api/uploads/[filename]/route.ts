import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { repoRoot } from "@/lib/paths";

export const runtime = "nodejs";

function contentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

function safeBasename(filename: string): string | null {
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base;
}

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params;
  const safe = safeBasename(filename);
  if (!safe) return new Response("not found", { status: 404 });

  const filePath = path.join(repoRoot(), "storage", "uploads", safe);
  try {
    const s = await stat(filePath);
    const stream = createReadStream(filePath);
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": contentType(safe),
        "content-length": String(s.size),
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

