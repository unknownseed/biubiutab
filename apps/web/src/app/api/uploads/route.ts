import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { repoRoot } from "@/lib/paths";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXT = new Set([".mp3", ".wav"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("missing file", { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return new Response("file too large", { status: 413 });
  }

  const originalFilename = file.name || "audio";
  const ext = path.extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return new Response("unsupported format", { status: 415 });
  }

  const storedFilename = `${crypto.randomUUID().replaceAll("-", "")}${ext}`;
  const uploadsDir = path.join(repoRoot(), "storage", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ab = await file.arrayBuffer();
  await writeFile(path.join(uploadsDir, storedFilename), Buffer.from(ab));

  return Response.json({
    storedFilename,
    originalFilename,
    size: file.size,
  });
}

