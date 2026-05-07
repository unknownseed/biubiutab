export function aiBaseUrl(): string {
  const v = process.env.AI_BASE_URL;
  const s = (v && v.trim()) || "http://127.0.0.1:8001";
  return s.replace(/\/+$/, "");
}

export async function aiFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const url = `${aiBaseUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  try {
    const headers = new Headers(init?.headers);
    const token = process.env.AI_SERVICE_TOKEN;
    if (token) headers.set("x-ai-token", token);
    if (!headers.get("x-request-id")) {
      const rid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      headers.set("x-request-id", rid);
    }
    const configuredTimeoutMs = Number(process.env.AI_FETCH_TIMEOUT_MS || "15000");
    const isVercel = !!process.env.VERCEL;
    const timeoutMs = isVercel ? Math.min(configuredTimeoutMs, 9000) : configuredTimeoutMs;
    const doFetch = async (ms: number) => {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const t = controller ? setTimeout(() => controller.abort(), ms) : null;
      try {
        return await fetch(url, { ...init, headers, cache: "no-store", signal: controller?.signal });
      } finally {
        if (t) clearTimeout(t);
      }
    };
    try {
      return await doFetch(timeoutMs);
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        if (isVercel) {
          return Response.json({ detail: "ai timeout (cold start). please retry shortly." }, { status: 503 });
        }
        const retryMs = Math.max(timeoutMs * 4, 60_000);
        return await doFetch(retryMs);
      }
      throw e;
    }
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "unknown network error";
    return new Response(
      `AI 服务不可用或无法连接（${msg}）。请确认已启动 services/ai，并且 AI_BASE_URL 指向正确地址：${aiBaseUrl()}`,
      {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  }
}
