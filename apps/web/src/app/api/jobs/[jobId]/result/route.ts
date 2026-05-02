import { aiFetch } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ detail: "unauthorized" }, { status: 401 });
  const res = await aiFetch(`/jobs/${encodeURIComponent(jobId)}/result`, { method: "GET", headers: { "x-user-id": user.id, "x-request-id": req.headers.get("x-request-id") || "" } });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
