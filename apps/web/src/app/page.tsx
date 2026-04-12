import UploadClient from "@/components/upload-client";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-5 md:items-end">
            <div className="md:col-span-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">音频 → 和弦谱 + 可弹 TAB</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                上传 MP3/WAV，自动识别和弦、段落结构，并生成清晰可读的谱例。前 8 小节优先“听音转写”，听不出来则用和弦分解兜底。
              </p>
            </div>
            <div className="md:col-span-2 md:justify-self-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Beta · SaaS UI
              </div>
            </div>
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
