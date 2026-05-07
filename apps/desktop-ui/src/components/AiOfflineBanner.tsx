import { useMemo, useState } from "react";
import { useHealth } from "./HealthProvider";

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
    <div className="sticky top-0 z-40 border-b border-paper-300 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-6 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">AI 服务离线</div>
          <div className="mt-0.5 text-xs text-ink-700/70">当前无法连接本地 AI（{health.baseUrl}）。生成/导出将无法使用。</div>
          {health.error ? <div className="mt-0.5 text-xs text-ink-700/60">原因：{health.error}</div> : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-retro-green px-3 py-1.5 text-xs font-semibold text-paper-50"
            onClick={refresh}
          >
            重试
          </button>
          <button
            type="button"
            className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800"
            onClick={() => setDismissed(true)}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

