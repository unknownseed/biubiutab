"use client";

import { useMemo, useState } from "react";
import { useHealth } from "./health-provider";

export default function AiOfflineBanner() {
  const { health, refresh } = useHealth();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = useMemo(() => {
    if (dismissed) return false;
    if (health.status === "checking") return false;
    return !health.ok;
  }, [dismissed, health.ok, health.status]);

  if (!shouldShow) return null;

  return (
    <div className="sticky top-14 z-30 border-b border-white/10 bg-[#000F27]">
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4 px-4 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">AI 服务离线</div>
          <div className="mt-0.5 text-xs text-slate-200">
            当前无法连接后端（{health.baseUrl || "AI_BASE_URL"}）。你仍可浏览页面，但生成/导出相关操作可能失败。
          </div>
          {health.error ? <div className="mt-0.5 text-xs text-slate-300">原因：{health.error}</div> : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            onClick={refresh}
          >
            重试
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            onClick={() => setDismissed(true)}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
