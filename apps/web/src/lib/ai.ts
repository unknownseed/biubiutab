export function aiBaseUrl(): string {
  const v = process.env.AI_BASE_URL;
  return (v && v.trim()) || "http://127.0.0.1:8001";
}

export async function aiFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const url = `${aiBaseUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  return await fetch(url, { ...init, cache: "no-store" });
}

