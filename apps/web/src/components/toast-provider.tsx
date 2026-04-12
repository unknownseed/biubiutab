"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (t: Omit<Toast, "id"> & { id?: string; durationMs?: number }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function variantStyles(v: ToastVariant) {
  switch (v) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-orange-200 bg-orange-50 text-orange-950";
    case "error":
      return "border-red-200 bg-red-50 text-red-950";
    default:
      return "border-slate-200 bg-white text-slate-950";
  }
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id"> & { id?: string; durationMs?: number }) => {
      const id = t.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast: Toast = { id, title: t.title, description: t.description, variant: t.variant };
      setItems((prev) => [...prev, toast].slice(-4));
      const duration = Math.max(1200, t.durationMs ?? 2600);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border p-3 shadow-[0_12px_30px_rgba(2,6,23,0.12)] ${variantStyles(
              t.variant
            )}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-xs text-slate-600">{t.description}</div> : null}
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-black/5"
                onClick={() => dismiss(t.id)}
              >
                关闭
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

