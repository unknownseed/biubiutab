"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  // We apply the marketing theme globally now, regardless of the page.
  const isMarketing = true;

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b transition-colors duration-300 border-[rgba(166,124,82,0.1)] bg-[#2F4F4F]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            {/* Place your logo at: apps/web/public/logo.png */}
            <Image src="/logo.png" alt="Biubiu Tab" width={160} height={28} className="h-7 w-auto brightness-0 invert opacity-90" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className={`transition-transform duration-300 hover:-translate-y-0.5 ${pathname === "/" ? "text-white" : "text-[#F9F7F2]/70 hover:text-white"}`}>首页</Link>
            <Link href="/play" className={`transition-transform duration-300 hover:-translate-y-0.5 ${pathname.startsWith("/play") || pathname.startsWith("/editor") ? "text-white" : "text-[#F9F7F2]/70 hover:text-white"}`}>BiuBIU弹唱</Link>
            <Link href="#" className="transition-transform duration-300 hover:-translate-y-0.5 text-[#F9F7F2]/70 hover:text-white">BiuBiu 教学</Link>
            <Link href="#" className="transition-transform duration-300 hover:-translate-y-0.5 text-[#F9F7F2]/70 hover:text-white">BiuBiu助教</Link>
            <Link href="#" className="transition-transform duration-300 hover:-translate-y-0.5 text-[#F9F7F2]/70 hover:text-white">BiuBiu客服</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-[#F9F7F2]/20 bg-[#F9F7F2]/10 text-[#F9F7F2] hover:bg-[#F9F7F2]/20">
            账号（占位）
          </div>
        </div>
      </div>
    </header>
  );
}
