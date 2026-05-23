import UploadClient from "@/components/upload-client";
import Image from "next/image";
import Link from "next/link";

export default function PlayPage() {
  return (
    <div className="flex-1 pt-14 text-ink-700 font-sans selection:bg-amber-400/30 relative overflow-hidden min-h-screen">
      {/* Download CTA Banner */}
      <div className="mx-auto w-full max-w-4xl px-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-retro-green/20 bg-retro-green/5 px-5 py-3 text-sm">
          <span className="text-ink-700/70 font-light tracking-wider">
            这是网页试用版（每月 3 次）。下载桌面客户端可获得<span className="font-semibold text-retro-green">无限次</span>本地 AI 制谱。
          </span>
          <Link href="/download" className="shrink-0 rounded-lg bg-retro-green px-4 py-1.5 text-xs tracking-widest text-paper-50 hover:bg-retro-green/90 transition-colors">
            免费下载
          </Link>
        </div>
      </div>
      {/* Background WebP Image */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="relative w-[85%] h-[85%]">
          <Image 
            src="/images/Sing_background.webp?v=2" 
            alt="Sing background" 
            fill 
            className="object-contain opacity-[0.06] grayscale-[50%]"
            sizes="85vw"
            unoptimized
            priority
          />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16 relative z-10">
        <header className="flex flex-col items-center gap-6 animate-fade-in-up">
          <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full px-4 text-center">
            <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-serif italic tracking-widest text-ink-800 leading-relaxed whitespace-nowrap text-center">
              “万物皆有裂痕，那是光照进来的地方。”
            </h1>
            <p className="text-base md:text-lg italic text-ink-700/60 font-light tracking-wide">
              There is a crack in everything, that&apos;s how the light gets in.
            </p>
            <p className="mt-2 text-sm text-wood-400 font-serif tracking-widest">
              —— Leonard Cohen
            </p>
          </div>
        </header>

        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <UploadClient />
        </div>
      </main>
    </div>
  );
}
