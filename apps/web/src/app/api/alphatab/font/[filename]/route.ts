import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function safeBasename(filename: string): string | null {
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base;
}

function contentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".woff") return "font/woff";
  if (ext === ".otf") return "font/otf";
  if (ext === ".ttf") return "font/ttf";
  if (ext === ".eot") return "application/vnd.ms-fontobject";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params;
  const safe = safeBasename(filename);
  if (!safe) return new Response("not found", { status: 404 });

  const filePath = path.join(process.cwd(), "node_modules", "@coderline", "alphatab", "dist", "font", safe);

  try {
    const s = await stat(filePath);
    const stream = createReadStream(filePath);
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": contentType(safe),
        "content-length": String(s.size),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

