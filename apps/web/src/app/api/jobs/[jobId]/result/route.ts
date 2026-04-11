import { aiFetch } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const res = await aiFetch(`/jobs/${encodeURIComponent(jobId)}/result`, { method: "GET" });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

