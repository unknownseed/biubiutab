import UploadClient from "@/components/upload-client";

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Biubiutab</h1>
          <p className="text-zinc-600">上传音频，AI 自动生成和弦谱/结构与谱例（六线谱）。</p>
        </header>
        <UploadClient />
      </main>
    </div>
  );
}
