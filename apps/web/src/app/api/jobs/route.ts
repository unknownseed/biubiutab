import { aiFetch } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscriptionInfo } from "@/lib/subscriptions";

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

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // --- Phase 4: 全局权限拦截 (AI 算力保护) ---
  const subInfo = await getUserSubscriptionInfo(user.id);
  
  if (subInfo.usedQuota >= subInfo.totalQuota) {
    return new Response(
      JSON.stringify({ 
        error: "Quota Exceeded", 
        message: subInfo.isPro 
          ? "您本月的 100 次高级制谱额度已用尽，请下个月再来。" 
          : "您本月的 3 次免费体验额度已用尽。请升级 Pro 解锁更多无限制次数和高级特权！",
        isPro: subInfo.isPro 
      }), 
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }
  // ----------------------------------------

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
    if (!safe.startsWith(`uploads/${user.id}/`)) return new Response("invalid filename", { status: 400 });
    audioPath = safe;
    storageProvider = "r2";
  } else {
    return new Response("missing input", { status: 400 });
  }

  const res = await aiFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": user.id },
    body: JSON.stringify({ 
      audio_path: audioPath,
      storage_provider: storageProvider,
      title: body.title,
    }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
