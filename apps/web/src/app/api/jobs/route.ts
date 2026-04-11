import path from "node:path";

import { aiFetch } from "@/lib/ai";
import { repoRoot } from "@/lib/paths";

export const runtime = "nodejs";

type CreateJobBody = {
  storedFilename: string;
  title?: string;
};

function safeBasename(filename: string): string | null {
  const base = path.basename(filename);
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  return base;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateJobBody | null;
  if (!body?.storedFilename) return new Response("missing storedFilename", { status: 400 });

  const safe = safeBasename(body.storedFilename);
  if (!safe) return new Response("invalid filename", { status: 400 });

  const audioPath = path.join(repoRoot(), "storage", "uploads", safe);
  const res = await aiFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ audio_path: audioPath, title: body.title }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

