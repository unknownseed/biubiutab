export function aiBaseUrl() {
  const v = (import.meta as any).env?.VITE_AI_BASE_URL;
  const s = (typeof v === "string" && v.trim()) || "http://127.0.0.1:8001";
  return s.replace(/\/+$/, "");
}

export async function aiGetJson<T>(pathname: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${aiBaseUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function aiPostJson<T>(pathname: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${aiBaseUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
