"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useHealth } from "./health-provider";
import { usePathname } from "next/navigation";

function dotClass(s: "checking" | "online" | "offline" | "degraded") {
  if (s === "online") return "bg-emerald-500";
  if (s === "offline") return "bg-red-500";
  return "bg-orange-400";
}

export default function Navbar() {
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const { health, refresh } = useHealth();
  const pathname = usePathname();
  const isMarketing = pathname === "/";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const open = pinnedOpen || hoverOpen;
  const canHover = useMemo(() => (typeof window === "undefined" ? false : window.matchMedia("(hover: hover)").matches), []);

  const statusText = health.status === "checking" ? "检测中…" : health.ok ? "在线" : "离线";
  const checkedText =
    health.checkedAt
      ? new Date(health.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "-";

  return (
    <header className={`fixed left-0 right-0 top-0 z-40 border-b transition-colors duration-300 ${
      isMarketing ? "border-[rgba(166,124,82,0.1)] bg-[#2F4F4F]" : "border-white/10 bg-[#000F27]"
    }`}>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            {/* Place your logo at: apps/web/public/logo.png */}
            <Image src="/logo.png" alt="Biubiu Tab" width={160} height={28} className={`h-7 w-auto ${isMarketing ? "brightness-0 invert opacity-90" : ""}`} priority />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className={`transition-transform duration-300 hover:-translate-y-0.5 ${pathname === "/" ? (isMarketing ? "text-white" : "text-white") : (isMarketing ? "text-[#F9F7F2]/70 hover:text-white" : "text-slate-400 hover:text-white")}`}>首页</Link>
            <Link href="/play" className={`transition-transform duration-300 hover:-translate-y-0.5 ${pathname.startsWith("/play") || pathname.startsWith("/editor") ? (isMarketing ? "text-white" : "text-white") : (isMarketing ? "text-[#F9F7F2]/70 hover:text-white" : "text-slate-400 hover:text-white")}`}>BiuBIU弹唱</Link>
            <Link href="#" className={`transition-transform duration-300 hover:-translate-y-0.5 ${isMarketing ? "text-[#F9F7F2]/70 hover:text-white" : "text-slate-400 hover:text-white"}`}>BiuBiu 教学</Link>
            <Link href="#" className={`transition-transform duration-300 hover:-translate-y-0.5 ${isMarketing ? "text-[#F9F7F2]/70 hover:text-white" : "text-slate-400 hover:text-white"}`}>BiuBiu助教</Link>
            <Link href="#" className={`transition-transform duration-300 hover:-translate-y-0.5 ${isMarketing ? "text-[#F9F7F2]/70 hover:text-white" : "text-slate-400 hover:text-white"}`}>BiuBiu客服</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-xs md:flex">
            <div
              className="relative"
              onMouseEnter={() => {
                if (canHover) setHoverOpen(true);
              }}
              onMouseLeave={() => {
                if (canHover) setHoverOpen(false);
              }}
            >
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isMarketing 
                    ? "border-[#F9F7F2]/20 bg-[#F9F7F2]/10 text-[#F9F7F2] hover:bg-[#F9F7F2]/20" 
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => {
                  // Mobile: click toggles open. Desktop: click pins.
                  setPinnedOpen((v) => !v);
                }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass(health.status)}`} />
                <span>AI：{statusText}</span>
              </button>

              {open ? (
                <div
                  className="absolute left-0 top-full mt-2 w-[360px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(2,6,23,0.18)]"
                  role="dialog"
                  aria-label="AI 服务状态"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotClass(health.status)}`} />
                        <div className="text-sm font-semibold text-slate-950">AI 服务：{statusText}</div>
                        {typeof health.latencyMs === "number" ? (
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                            {health.latencyMs}ms
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        最近检查：{checkedText}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => setPinnedOpen(false)}
                    >
                      关闭
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-slate-700">AI_BASE_URL</div>
                        {health.baseUrl ? (
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-white"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(health.baseUrl || "");
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            复制
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-slate-600">
                        {health.baseUrl || "-"}
                      </div>
                    </div>

                    {!health.ok && health.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <div className="font-medium">错误</div>
                        <div className="mt-1 break-words text-red-700">{health.error}</div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                        onClick={refresh}
                      >
                        立即重试
                      </button>
                      <div className="text-[11px] text-slate-500">每 5 秒自动刷新</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            isMarketing
              ? "border-[#F9F7F2]/20 bg-[#F9F7F2]/10 text-[#F9F7F2] hover:bg-[#F9F7F2]/20 cursor-pointer"
              : "border-white/15 bg-white/5 text-slate-100"
          }`}>
            账号（占位）
          </div>
        </div>
      </div>
    </header>
  );
}
