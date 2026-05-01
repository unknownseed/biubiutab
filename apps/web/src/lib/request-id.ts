export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getRequestId(headers: Headers): string {
  const v = headers.get("x-request-id");
  return (v && v.trim()) || newRequestId();
}

