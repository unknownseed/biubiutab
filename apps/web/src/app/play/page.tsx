import UploadClient from "@/components/upload-client";
import Image from "next/image";

export default function PlayPage() {
  return (
    <div className="flex-1 pt-14 bg-white text-ink-700 font-sans selection:bg-amber-400/30 relative overflow-hidden">
      {/* Background WebP Image */}
      <div className="absolute inset-0 -z-20 flex items-center justify-center pointer-events-none">
        <div className="relative w-[85%] h-[85%]">
          <Image 
            src="/images/Sing_background.webp" 
            alt="Sing background" 
            fill 
            priority
            className="object-contain opacity-[0.06] grayscale-[50%]"
            sizes="85vw"
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
