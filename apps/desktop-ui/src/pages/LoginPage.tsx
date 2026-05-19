import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sb = useMemo(() => supabase(), []);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const m = params.get("mode");
    if (m === "signup") setMode("signup");
    if (m === "login") setMode("login");
  }, [params]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("已发送验证邮件，请去邮箱完成验证后再登录。");
          return;
        }
        navigate("/", { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper-100 p-4">
      <div className="w-full max-w-md bg-paper-50 rounded-2xl shadow-xl border border-wood-400/20 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-retro-green text-paper-50 font-serif font-bold text-2xl mb-4">
            B
          </div>
          <h1 className="text-2xl font-serif font-bold text-retro-green">{mode === "login" ? "欢迎回到 BiuBiu Tab" : "加入 BiuBiu Tab"}</h1>
          <p className="text-sm text-ink-700/60 mt-2">{mode === "login" ? "登录以继续你的音乐之旅" : "创建一个免费账号开始制作吉他谱"}</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="email">
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-wood-400/30 bg-white text-ink-800 placeholder:text-ink-700/30 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-wood-400/30 bg-white text-ink-800 placeholder:text-ink-700/30 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-all"
            />
          </div>

          {error ? <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">{error}</div> : null}
          {notice ? <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg">{notice}</div> : null}

          <button
            type="button"
            disabled={loading || !email || !password}
            onClick={() => void submit()}
            className="w-full py-3 px-4 bg-retro-green hover:bg-wood-500 text-paper-50 font-sans tracking-widest rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
          </button>

          <div className="text-center text-sm text-ink-700/70">
            {mode === "login" ? "还没有账号？" : "已经有账号了？"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setNotice(null);
              }}
              className="ml-2 text-wood-500 hover:text-wood-400 font-medium transition-colors"
            >
              {mode === "login" ? "立即注册" : "直接登录"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
