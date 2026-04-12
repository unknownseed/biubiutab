import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);

function findAppRoot(): string {
  const here = fileURLToPath(import.meta.url);
  const marker = `${path.sep}.next${path.sep}`;
  const idx = here.lastIndexOf(marker);
  if (idx === -1) return process.cwd();
  return here.slice(0, idx);
}

function safeBasename(filename: unknown): string | null {
  if (typeof filename !== "string" || filename.length === 0) return null;
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
  const params = await ctx.params;
  const safe = safeBasename(params?.filename);
  if (!safe) {
    console.error(`[Font API] Invalid filename requested: ${params?.filename}`);
    return new Response("not found", { status: 404 });
  }

  const appRoot = findAppRoot();
  const localFont = path.join(appRoot, "node_modules", "@coderline", "alphatab", "dist", "font", safe);
  const localFontAlt = path.join(appRoot, "node_modules", "@coderline", "alphatab", "dist", "font", safe);

  try {
    const candidates: string[] = [localFont, localFontAlt];

    try {
      const entry = require.resolve("@coderline/alphatab");
      const entryDir = path.dirname(entry);
      candidates.push(
        path.join(entryDir, "font", safe),
        path.join(entryDir, "dist", "font", safe),
        path.join(entryDir, "..", "dist", "font", safe),
        path.join(entryDir, "..", "font", safe)
      );
    } catch {}

    let filePath: string | null = null;
    let s: { size: number } | null = null;
    for (const candidate of candidates) {
      try {
        s = await stat(candidate);
        filePath = candidate;
        break;
      } catch {
        continue;
      }
    }
    if (!filePath || !s) {
      console.error(`[Font API] Font not found: ${safe}. Looked in:`, candidates);
      return new Response("not found", { status: 404 });
    }

    console.log(`[Font API] Serving font: ${safe} from ${filePath}`);

    const stream = createReadStream(filePath);
    return new Response(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": contentType(safe),
        "content-length": String(s.size),
        "cache-control": "public, max-age=31536000, immutable",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error(`[Font API] Error serving font ${safe}:`, error);
    return new Response("not found", { status: 404 });
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
