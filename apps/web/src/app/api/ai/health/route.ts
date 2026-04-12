import { aiBaseUrl, aiFetch } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const res = await aiFetch("/health", { method: "GET" });
  const raw = await res.text();

  // Normalize to a stable JSON for the frontend.
  if (!res.ok) {
    return Response.json(
      {
        ok: false,
        status: "offline",
        httpStatus: res.status,
        baseUrl: aiBaseUrl(),
        error: raw || "AI health check failed",
      },
      { status: 200 }
    );
  }

  try {
    const data = JSON.parse(raw) as { status?: string };
    const ok = (data?.status || "").toLowerCase() === "ok";
    return Response.json(
      { ok, status: ok ? "online" : "degraded", baseUrl: aiBaseUrl(), raw: data },
      { status: 200 }
    );
  } catch {
    return Response.json(
      { ok: true, status: "online", baseUrl: aiBaseUrl(), raw },
      { status: 200 }
    );
  }
}

