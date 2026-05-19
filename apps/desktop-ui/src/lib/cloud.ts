export async function cloudGetText(urlPath: string): Promise<string> {
  if (window.desktop?.cloudGetText) return await window.desktop.cloudGetText(urlPath);
  const res = await fetch(urlPath);
  if (!res.ok) throw new Error(`http ${res.status}`);
  return await res.text();
}

export async function cloudGetBytes(urlPath: string): Promise<Uint8Array> {
  if (window.desktop?.cloudGetBytes) return await window.desktop.cloudGetBytes(urlPath);
  const res = await fetch(urlPath);
  if (!res.ok) throw new Error(`http ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function cloudPostJson(urlPath: string, body: unknown, headers?: Record<string, string>): Promise<{ ok: boolean; status: number; text: string }> {
  if (window.desktop?.cloudPostJson) return await window.desktop.cloudPostJson(urlPath, body, headers);
  const res = await fetch(urlPath, { method: "POST", headers: { "content-type": "application/json", ...(headers || {}) }, body: JSON.stringify(body ?? {}) });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

