"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type HealthSnapshot = {
  ok: boolean;
  status: "checking" | "online" | "offline" | "degraded";
  baseUrl?: string;
  error?: string;
  checkedAt?: number;
  latencyMs?: number;
};

type HealthContextValue = {
  health: HealthSnapshot;
  refresh: () => void;
};

const HealthContext = createContext<HealthContextValue | null>(null);

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}

export default function HealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<HealthSnapshot>({ ok: false, status: "checking" });
  const intervalRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const pollOnce = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch("/api/ai/health", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: string; baseUrl?: string; error?: string }
        | null;
      if (cancelledRef.current) return;
      const latencyMs = Math.round(performance.now() - t0);
      const checkedAt = Date.now();
      const ok = Boolean(data?.ok);
      const status = (data?.status as HealthSnapshot["status"]) || (ok ? "online" : "offline");
      setHealth({
        ok,
        status: ok ? "online" : status === "degraded" ? "degraded" : "offline",
        baseUrl: data?.baseUrl,
        error: data?.error,
        checkedAt,
        latencyMs,
      });
    } catch (e) {
      if (cancelledRef.current) return;
      const latencyMs = Math.round(performance.now() - t0);
      const checkedAt = Date.now();
      setHealth({
        ok: false,
        status: "offline",
        error: e instanceof Error ? e.message : "network error",
        checkedAt,
        latencyMs,
      });
    }
  }, []);

  const refresh = useCallback(() => {
    void pollOnce();
  }, [pollOnce]);

  useEffect(() => {
    cancelledRef.current = false;
    // Run the first poll asynchronously (avoid triggering setState directly within effect body).
    window.setTimeout(() => void pollOnce(), 0);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => void pollOnce(), 5000);
    return () => {
      cancelledRef.current = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [pollOnce]);

  const value = useMemo<HealthContextValue>(() => ({ health, refresh }), [health, refresh]);
  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}
