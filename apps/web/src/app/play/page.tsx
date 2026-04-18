import UploadClient from "@/components/upload-client";

export default function PlayPage() {
  return (
    <div className="flex-1 pt-14 bg-white text-ink-700 font-sans selection:bg-amber-400/30">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16">
        <header className="flex flex-col items-center gap-6 animate-fade-in-up">
          <div className="flex flex-col gap-4 max-w-4xl mx-auto text-center">
            <h1 className="text-2xl md:text-4xl font-serif italic tracking-widest text-ink-800 leading-relaxed">
              万物皆有裂痕，那是光照进来的地方。
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
