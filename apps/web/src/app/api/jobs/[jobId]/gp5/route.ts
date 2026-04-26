import { aiFetch } from "@/lib/ai";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const level = url.searchParams.get("level") || "4";

  // 1. Check Supabase to see if this is an R2 job
  const { data: dbJob } = await supabase.from("ai_jobs").select("*").eq("id", jobId).single();
  
  if (dbJob?.preview?.storage_provider === "r2" || dbJob?.storage_provider === "r2" || dbJob?.audio_path?.startsWith("uploads/")) {
    let publicDomain = process.env.CLOUDFLARE_PUBLIC_DOMAIN;
    if (!publicDomain) {
      return new Response("CLOUDFLARE_PUBLIC_DOMAIN not configured", { status: 500 });
    }
    // Remove trailing slash if user added it
    publicDomain = publicDomain.replace(/\/$/, "");
    
    const filename = ["1", "2", "3"].includes(level) ? `result_l${level}.gp5` : "result.gp5";
    const r2Path = `results/${jobId}/${filename}`;
    const r2Url = `${publicDomain}/${r2Path}`;
    
    // Fetch it on the server side to bypass browser CORS issues with .r2.dev domains
    const fileRes = await fetch(r2Url);
    if (!fileRes.ok) {
      return new Response("GP5 file not found on R2", { status: 404 });
    }
    
    return new Response(fileRes.body, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${jobId}.gp5"`,
      },
    });
  }

  // 2. Fallback to local python backend fetching
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
