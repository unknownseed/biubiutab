import { aiFetch } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreateJobBody = {
  storedFilename?: string;
  url?: string;
  title?: string;
};

function safeObjectKey(filename: string): string | null {
  // 允许路径中包含斜杠，因为 R2 的 object key 可能是 "uploads/123.mp3"
  if (!/^[a-zA-Z0-9._\-/]+$/.test(filename)) return null;
  return filename;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (await req.json().catch(() => null)) as CreateJobBody | null;
  if (!body) return new Response("bad request", { status: 400 });

  let audioPath = "";
  let storageProvider = "";

  if (body.url) {
    if (!body.url.startsWith("http://") && !body.url.startsWith("https://")) {
      return new Response("invalid url", { status: 400 });
    }
    audioPath = body.url;
    storageProvider = "url";
  } else if (body.storedFilename) {
    const safe = safeObjectKey(body.storedFilename);
    if (!safe) return new Response("invalid filename", { status: 400 });
    audioPath = safe;
    storageProvider = "r2";
  } else {
    return new Response("missing input", { status: 400 });
  }

  const res = await aiFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 
      audio_path: audioPath,
      storage_provider: storageProvider,
      title: body.title,
      user_id: user?.id || null
    }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

