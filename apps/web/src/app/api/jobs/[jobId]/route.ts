import { aiFetch } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const res = await aiFetch(`/jobs/${encodeURIComponent(jobId)}`, { method: "GET", headers: { "x-user-id": user.id } });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
