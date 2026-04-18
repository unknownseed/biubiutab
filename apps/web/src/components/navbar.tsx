"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  // We apply the marketing theme globally now, regardless of the page.
  const isMarketing = true;

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b transition-colors duration-500 border-wood-400/20 bg-retro-green/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="Biubiu Tab" width={160} height={28} className="h-7 w-auto brightness-0 invert opacity-90" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-sans tracking-widest text-paper-100/70">
            <Link href="/" className={`relative group transition-colors duration-300 ${pathname === "/" ? "text-paper-50" : "hover:text-paper-50"}`}>
              首页
              <span className={`absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 ${pathname === "/" ? "bg-wood-400" : "bg-transparent group-hover:bg-wood-400"}`} />
            </Link>
            <Link href="/play" className={`relative group transition-colors duration-300 ${pathname.startsWith("/play") || pathname.startsWith("/editor") ? "text-paper-50" : "hover:text-paper-50"}`}>
              BiuBIU弹唱
              <span className={`absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 ${pathname.startsWith("/play") || pathname.startsWith("/editor") ? "bg-wood-400" : "bg-transparent group-hover:bg-wood-400"}`} />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              BiuBiu 教学
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              BiuBiu助教
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              BiuBiu客服
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
            <Link href="#" className="relative group transition-colors duration-300 hover:text-paper-50">
              费用
              <span className="absolute -bottom-1 left-0 w-full h-[1px] transition-all duration-500 bg-transparent group-hover:bg-wood-400" />
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="bg-retro-green text-paper-50 text-sm font-sans tracking-widest border border-paper-100/30 px-6 py-2 transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-paper-100">
            登录
          </button>
        </div>
      </div>
    </header>
  );
}
