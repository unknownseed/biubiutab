export function aiBaseUrl(): string {
  const v = process.env.AI_BASE_URL;
  return (v && v.trim()) || "http://127.0.0.1:8001";
}

export async function aiFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const url = `${aiBaseUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  try {
    const headers = new Headers(init?.headers);
    const token = process.env.AI_SERVICE_TOKEN;
    if (token) headers.set("x-ai-token", token);
    const timeoutMs = Number(process.env.AI_FETCH_TIMEOUT_MS || "15000");
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, { ...init, headers, cache: "no-store", signal: controller?.signal });
    } finally {
      if (t) clearTimeout(t);
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
