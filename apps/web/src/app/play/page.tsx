import UploadClient from "@/components/upload-client";

export default function PlayPage() {
  return (
    <div className="flex-1 pt-14 bg-[#F9F7F2] text-[#2F4F4F] font-sans selection:bg-[#FFBF00]/30">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16">
        <header className="flex flex-col items-center gap-6">
          <div className="flex flex-col gap-4 max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-serif tracking-widest text-[#2F4F4F] leading-relaxed">
              聆听风里的旋律
            </h1>
            <p className="text-base text-[#2F4F4F]/60 font-light tracking-wide">
              上传一段吉他音频，让 AI 为你镌刻出完整的指尖记忆。
            </p>
          </div>
        </header>

        <UploadClient />
      </main>
    </div>
  );
}
