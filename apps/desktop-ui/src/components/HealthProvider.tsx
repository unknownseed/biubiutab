import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { aiBaseUrl } from "../lib/ai";

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
      const res = await fetch(`${aiBaseUrl()}/health`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { status?: string } | null;
      if (cancelledRef.current) return;
      const latencyMs = Math.round(performance.now() - t0);
      const checkedAt = Date.now();
      const ok = res.ok && (data?.status || "").toLowerCase() === "ok";
      setHealth({
        ok,
        status: ok ? "online" : "offline",
        baseUrl: aiBaseUrl(),
        error: ok ? undefined : `HTTP ${res.status}`,
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
        baseUrl: aiBaseUrl(),
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

