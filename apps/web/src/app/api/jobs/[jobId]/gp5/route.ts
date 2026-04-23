import { aiFetch } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const level = url.searchParams.get("level") || "4";
  
  const res = await aiFetch(`/jobs/${encodeURIComponent(jobId)}/result.gp5?level=${level}`, { method: "GET" });
  
  if (!res.ok) {
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "text/plain" },
    });
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Response(arrayBuffer, {
    status: res.status,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${jobId}.gp5"`,
    },
  });
}
