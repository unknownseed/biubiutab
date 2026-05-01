type Bucket = {
  tokens: number;
  updatedAt: number;
};

const g = globalThis as unknown as { __biubiutabRateLimit?: Map<string, Bucket> };
const store = g.__biubiutabRateLimit || new Map<string, Bucket>();
g.__biubiutabRateLimit = store;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b) {
    store.set(key, { tokens: limit - 1, updatedAt: now });
    return { ok: true, retryAfterMs: 0 };
  }
  const elapsed = now - b.updatedAt;
  if (elapsed >= windowMs) {
    store.set(key, { tokens: limit - 1, updatedAt: now });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.tokens <= 0) {
    return { ok: false, retryAfterMs: windowMs - elapsed };
  }
  b.tokens -= 1;
  store.set(key, b);
  return { ok: true, retryAfterMs: 0 };
}

