import UploadClient from "@/components/upload-client";

export default function PlayPage() {
  return (
    <div className="flex-1 pt-14 bg-[#F9F7F2] text-[#2F4F4F] font-sans selection:bg-[#FFBF00]/30">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16">
        <header className="flex flex-col items-center gap-6">
          <div className="flex flex-col gap-4 max-w-2xl mx-auto text-center">
            <h1 className="text-2xl md:text-4xl font-serif tracking-widest text-[#2F4F4F] leading-relaxed">
              “万物皆有裂痕，那是光照进来的地方。”
            </h1>
            <p className="text-base md:text-lg italic text-[#2F4F4F]/60 font-light tracking-wide">
              (There is a crack in everything, that&apos;s how the light gets in.)
            </p>
            <p className="mt-2 text-sm text-[#A67C52] font-serif tracking-widest">
              —— 摇滚民谣诗人 Leonard Cohen
            </p>
          </div>
        </header>

        <UploadClient />
      </main>
    </div>
  );
}
