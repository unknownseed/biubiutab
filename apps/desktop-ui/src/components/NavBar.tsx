import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isAdminEmail } from "../lib/admin";
import { useSubscription } from "../hooks/useSubscription";

type UserInfo = {
  id: string;
  email: string | null;
};

function navClassName({ isActive }: { isActive: boolean }) {
  return `text-sm tracking-widest transition-colors ${isActive ? "text-retro-green" : "text-ink-700/70 hover:text-ink-900"}`;
}

export default function NavBar() {
  const navigate = useNavigate();
  const sb = useMemo(() => supabase(), []);
  const [user, setUser] = useState<UserInfo | null>(null);
  const { info: sub } = useSubscription();

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
    };
    void init();
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  const signOut = async () => {
    await sb.auth.signOut().catch(() => {});
    navigate("/login", { replace: true });
  };

  const openPricing = () => {
    window.open("http://localhost:3000/pricing", "_blank", "noopener,noreferrer");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-paper-300 bg-paper-50/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="font-serif tracking-widest text-ink-900">
            BiuBiu Tab
          </NavLink>
          <nav className="flex items-center gap-5">
            <NavLink to="/play" className={navClassName}>
              彈唱
            </NavLink>
            <NavLink to="/learn" className={navClassName}>
              教學
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {sub.isPro ? (
                <span className="rounded-md bg-retro-green/10 border border-retro-green/20 px-2 py-0.5 text-xs tracking-wider text-retro-green">
                  Pro
                </span>
              ) : (
                <span
                  className="rounded-md bg-paper-200 border border-paper-300 px-2 py-0.5 text-xs tracking-wider text-ink-700/60 cursor-pointer hover:text-retro-green hover:border-retro-green/40 transition-colors"
                  onClick={openPricing}
                  title={user ? `${sub.usedQuota}/${sub.totalQuota} 次本月` : "升级 Pro"}
                >
                  Free · {sub.usedQuota}/{sub.totalQuota}
                </span>
              )}
              <div className="max-w-[220px] truncate text-xs tracking-widest text-ink-700/70">{user.email || user.id}</div>
              <NavLink to="/dashboard" className={navClassName}>
                我的曲譜
              </NavLink>
              {isAdminEmail(user.email) ? (
                <NavLink to="/admin/teaching" className={navClassName}>
                  教學管理
                </NavLink>
              ) : null}
              <NavLink to="/update-password" className={navClassName}>
                改密碼
              </NavLink>
              <button type="button" className="text-sm tracking-widest text-ink-700/70 hover:text-ink-900" onClick={() => void signOut()}>
                登出
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClassName}>
              登入
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
