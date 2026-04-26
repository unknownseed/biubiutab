import { aiFetch } from "@/lib/ai";

export const runtime = "nodejs";

type CreateJobBody = {
  storedFilename: string;
  title?: string;
};

function safeObjectKey(filename: string): string | null {
  // 允许路径中包含斜杠，因为 R2 的 object key 可能是 "uploads/123.mp3"
  if (!/^[a-zA-Z0-9._\-/]+$/.test(filename)) return null;
  return filename;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateJobBody | null;
  if (!body?.storedFilename) return new Response("missing storedFilename", { status: 400 });

  const safe = safeObjectKey(body.storedFilename);
  if (!safe) return new Response("invalid filename", { status: 400 });

  // 这里的 safe 就是存放在 Cloudflare R2 bucket 中的文件 Key
  // 我们将 storage_provider 设置为 r2，以便后端知道去哪里下载它
  const res = await aiFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 
      audio_path: safe,
      storage_provider: "r2",
      title: body.title 
    }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

