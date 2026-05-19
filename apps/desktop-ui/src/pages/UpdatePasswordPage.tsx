import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      if (!data.user) navigate("/login", { replace: true });
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [sb, navigate]);

  const submit = async () => {
    if (!userId) return;
    if (!password || password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== password2) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setNotice("密码已更新");
      setPassword("");
      setPassword2("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-paper-100 py-10">
      <div className="mx-auto w-full max-w-2xl px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-serif tracking-widest text-ink-900">修改密碼</h1>
          <div className="mt-2 text-sm font-light tracking-wider text-ink-700/60">此操作會更新你的 Supabase 帳號密碼。</div>
        </div>

        <div className="rounded-2xl border border-paper-300 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1" htmlFor="p1">
                新密碼
              </label>
              <input
                id="p1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-800 mb-1" htmlFor="p2">
                重複新密碼
              </label>
              <input
                id="p2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900"
              />
            </div>

            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg bg-retro-green px-6 py-3 text-sm tracking-widest text-paper-50 disabled:opacity-50"
                disabled={loading || !password || !password2}
                onClick={() => void submit()}
              >
                {loading ? "請稍候..." : "保存"}
              </button>
              <button type="button" className="rounded-lg border border-paper-300 bg-white px-6 py-3 text-sm tracking-widest text-ink-900" onClick={() => navigate(-1)}>
                返回
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

