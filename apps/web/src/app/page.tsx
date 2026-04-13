import UploadClient from "@/components/upload-client";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col items-center gap-6 py-8">
          <div className="flex flex-col gap-3 max-w-2xl mx-auto text-center">
            <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-slate-900 leading-relaxed">
              “万物皆有裂痕，那是光照进来的地方。”
            </h1>
            <p className="text-base md:text-lg italic text-slate-500">
              (There is a crack in everything, that&apos;s how the light gets in.)
            </p>
            <p className="mt-4 text-sm font-medium text-slate-400">
              —— 摇滚民谣诗人 Leonard Cohen
            </p>
          </div>
        </header>

        <UploadClient />

        <footer className="pt-2 text-xs text-slate-500">
          © {new Date().getFullYear()} Biubiutab · Built for fast practice workflows
        </footer>
      </main>
    </div>
  );
}
