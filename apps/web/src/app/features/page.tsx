import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="flex-1 bg-white text-ink-700 font-sans selection:bg-retro-green/20">
      <main className="mx-auto flex w-full max-w-5xl flex-col px-[2rem] pb-[8rem]">

        <section className="flex flex-col items-center justify-center text-center gap-8 pt-24 pb-12">
          <span className="text-xs font-mono tracking-[0.3em] text-wood-400 uppercase border-b border-wood-400/30 pb-2">
            Features
          </span>
          <h1 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
            全套 AI 吉他学习工具
          </h1>
          <p className="text-lg text-ink-700 font-light tracking-wider max-w-lg leading-relaxed">
            BiuBiu Tab 原生桌面应用，为每一位吉他手打造。
          </p>
        </section>

        {[
          {
            title: "AI 智能制谱",
            subtitle: "上传一段音频，AI 自动生成和弦、旋律、歌词与吉他谱。",
            details: [
              "支持 MP3 / WAV 音频格式",
              "自动识别和弦进行与节奏型",
              "人声分离 —— 提取干净的伴奏",
              "生成 GP5 / PDF 格式乐谱",
            ],
            cta: { text: "下载桌面版 →", href: "/download" },
            accent: "bg-retro-green",
          },
          {
            title: "跟弹练习",
            subtitle: "谱面与音频同步，一拍一拍跟着弹，变速不变调。",
            details: [
              "和弦逐拍显示，节奏可视化",
              "歌词同步滚动",
              "指法位置放大提示",
              "0.5x - 2x 变速练习",
            ],
            cta: { text: "了解更多 →", href: "/download" },
            accent: "bg-wood-500",
          },
          {
            title: "海量教学曲库",
            subtitle: "从预热练习到 Solo 即兴，每一步都有专业指导。",
            details: [
              "四级难度：预热 / 基础 / 进阶 / Solo",
              "每首歌曲分段拆解练习",
              "难点专项突破",
              "高清演奏示范视频（Pro）",
            ],
            cta: { text: "下载桌面版 →", href: "/download" },
            accent: "bg-amber-600",
          },
          {
            title: "本地 AI，隐私无忧",
            subtitle: "AI 模型在本地运行，音频不离开你的电脑。",
            details: [
              "无需上传到云端，处理更快",
              "离线可用，不受网络限制",
              "无限次制谱（桌面版专属）",
              "支持 Apple Silicon 原生加速",
            ],
            cta: { text: "下载桌面版 →", href: "/download" },
            accent: "bg-slate-700",
          },
        ].map((feat, i) => (
          <section key={i} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 lg:gap-16 py-16 border-t border-paper-300 first:border-t-0">
            <div className="flex flex-col items-start gap-3">
              <div className={`w-3 h-3 rounded-full ${feat.accent}`} />
              <span className="text-xs font-mono tracking-[0.25em] text-ink-700/50 uppercase">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="flex flex-col gap-5">
              <h2 className="text-2xl lg:text-3xl font-serif text-ink-900 tracking-wide">{feat.title}</h2>
              <p className="text-base text-ink-700/80 font-light tracking-wider leading-relaxed">{feat.subtitle}</p>
              <ul className="space-y-2 mt-2">
                {feat.details.map((d, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-ink-700/70">
                    <span className="text-retro-green mt-1 shrink-0">✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <Link href={feat.cta.href} className="mt-3 inline-flex items-center gap-1 text-sm font-serif tracking-widest text-retro-green hover:text-ink-900 transition-colors">
                {feat.cta.text}
              </Link>
            </div>
          </section>
        ))}

        <div className="mt-16 p-10 rounded-2xl bg-retro-green text-center">
          <h2 className="text-3xl font-serif text-paper-50 tracking-wide mb-4">准备好开始了吗？</h2>
          <p className="text-paper-50/80 mb-8 text-lg font-light tracking-wider">
            免费下载，离线也能随时练琴。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/download"
              className="inline-flex items-center justify-center px-10 py-4 text-lg tracking-[0.2em] text-retro-green font-serif bg-paper-50 border border-paper-50 transition-colors duration-500 hover:bg-transparent hover:text-paper-50 rounded-none"
            >
              下载桌面版
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-10 py-4 text-lg tracking-[0.2em] text-paper-50 font-serif border border-paper-50 transition-colors duration-500 hover:bg-paper-50 hover:text-retro-green rounded-none"
            >
              升级 Pro
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
