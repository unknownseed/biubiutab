import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setEmail(data.user?.email ?? null);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb]);

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="mb-8">
          <div className="text-xs tracking-[0.35em] text-ink-700/60">DESKTOP</div>
          <h1 className="mt-2 text-3xl font-serif tracking-widest text-ink-900">BiuBiu Tab</h1>
          <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">{email ? `已登入：${email}` : "AI 吉他制谱 · 跟弹练习 · 海量教学曲库"}</div>
        </div>

        {!email ? (
          <div className="mb-6 rounded-2xl border border-retro-green/20 bg-retro-green/5 p-5 text-center">
            <p className="text-sm text-ink-700/70 leading-relaxed mb-4">
              登录后可解锁：本地 AI 制谱（每月免费 3 次）、完整跟练模式、进阶教学模块。
            </p>
            <button
              type="button"
              className="rounded-lg bg-retro-green px-8 py-3 text-sm tracking-widest text-paper-50"
              onClick={() => navigate("/login")}
            >
              登入 / 注册
            </button>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <button
            type="button"
            className="rounded-2xl border border-paper-300 bg-white p-6 text-left shadow-sm transition-colors hover:bg-paper-50"
            onClick={() => navigate("/play")}
          >
            <div className="text-xs tracking-[0.35em] text-ink-700/60">BIUBIU SING</div>
            <div className="mt-2 text-xl font-serif tracking-widest text-ink-900">彈唱製譜</div>
            <div className="mt-2 text-sm text-ink-700/70">選擇音訊 → 生成 GP5 → 編輯 → 進入跟練</div>
          </button>

          <button
            type="button"
            className="rounded-2xl border border-paper-300 bg-white p-6 text-left shadow-sm transition-colors hover:bg-paper-50"
            onClick={() => navigate("/learn")}
          >
            <div className="text-xs tracking-[0.35em] text-ink-700/60">BIUBIU LEARN</div>
            <div className="mt-2 text-xl font-serif tracking-widest text-ink-900">教學課程</div>
            <div className="mt-2 text-sm text-ink-700/70">預習 / 基礎 / 進階 / Solo 模組化練習</div>
          </button>
        </div>
      </div>
    </main>
  );
}

