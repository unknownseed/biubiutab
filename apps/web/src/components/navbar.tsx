"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Navbar({ initialUser }: { initialUser: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(initialUser);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    // 监听登录状态变化 (跨标签页或纯客户端行为)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    router.refresh();
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b transition-colors duration-500 border-wood-400/20 bg-retro-green/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-paper-50 text-retro-green font-serif font-bold text-lg group-hover:bg-wood-400 group-hover:text-paper-50 transition-colors duration-500">
              B
            </div>
            <span className="font-logo text-2xl md:text-3xl text-paper-50 tracking-wide opacity-90 group-hover:opacity-100 transition-opacity">
              BiuBiu Tab
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-sans tracking-widest text-paper-100/70 shrink-0">
            <Link href="/" className={`relative group transition-colors duration-300 ${mounted && pathname === "/" ? "text-paper-50" : "hover:text-paper-50"}`}>
              首页
              <span className={`absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 ${mounted && pathname === "/" ? "bg-wood-400" : "bg-transparent group-hover:bg-wood-400"}`} />
            </Link>
            <Link href="/play" className={`relative group transition-colors duration-300 ${mounted && (pathname.startsWith("/play") || pathname.startsWith("/editor")) ? "text-paper-50" : "hover:text-paper-50"}`}>
              BiuBIU弹唱
              <span className={`absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 ${mounted && (pathname.startsWith("/play") || pathname.startsWith("/editor")) ? "bg-wood-400" : "bg-transparent group-hover:bg-wood-400"}`} />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              BiuBiu教学
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              BiuBiu AI
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              价格
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              支持
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {mounted ? (
            user ? (
              <div 
                className="relative group"
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-paper-50/10 text-paper-50 font-sans font-bold border border-paper-100/30 group-hover:bg-wood-400 group-hover:border-wood-400 transition-colors cursor-pointer"
                  title={user.email || '用户菜单'}
                >
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>

                <div 
                  className={`absolute right-0 mt-2 w-48 py-2 bg-paper-50 border border-wood-400/20 rounded-lg shadow-xl z-50 transition-all duration-200 origin-top-right ${
                    isDropdownOpen 
                      ? 'opacity-100 scale-100 visible' 
                      : 'opacity-0 scale-95 invisible'
                  }`}
                >
                  {/* Invisible bridge to prevent hover loss between button and menu */}
                  <div className="absolute -top-2 left-0 right-0 h-2 bg-transparent" />
                  
                  <div className="px-4 py-3 border-b border-wood-400/10 mb-2">
                    <p className="text-xs text-ink-700/60 tracking-wider font-light truncate" title={user.email}>
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2.5 text-sm font-sans tracking-widest text-ink-800 hover:bg-wood-400/10 hover:text-retro-green transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    我的曲谱
                  </Link>
                  <Link
                    href="/update-password"
                    className="block px-4 py-2.5 text-sm font-sans tracking-widest text-ink-800 hover:bg-wood-400/10 hover:text-retro-green transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    修改密码
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left block px-4 py-2.5 text-sm font-sans tracking-widest text-red-600/80 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    登出
                  </button>
                </div>
              </div>
            ) : (
              <Link 
                href="/login"
                className="bg-retro-green text-paper-50 text-sm font-sans tracking-widest border border-paper-100/30 px-6 py-2 transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-paper-100 inline-block"
              >
                登录
              </Link>
            )
          ) : (
            <div className="w-9 h-9 rounded-full border border-paper-100/30 bg-paper-50/5 animate-pulse"></div>
          )}
        </div>
      </div>
    </header>
  );
}
