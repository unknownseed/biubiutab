import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="flex-1 bg-white text-ink-700 font-sans selection:bg-retro-green/20">
      <main className="mx-auto flex w-full max-w-3xl flex-col px-[2rem] pb-[8rem]">

        <section className="flex flex-col items-center justify-center text-center gap-8 pt-24 pb-12">
          <span className="text-xs font-mono tracking-[0.3em] text-wood-400 uppercase border-b border-wood-400/30 pb-2">
            Support
          </span>
          <h1 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
            帮助与支持
          </h1>
          <p className="text-lg text-ink-700 font-light tracking-wider max-w-lg leading-relaxed">
            常见的安装、使用与付费问题解答。
          </p>
        </section>

        <section className="space-y-1">
          {[
            { q: "BiuBiu Tab 需要付费吗？", a: "基础功能（AI 制谱每月 3 次、基础教学模块、跟弹练习）完全免费。Pro 会员（¥29/月）解锁每月 100 次制谱、进阶教学模块和演示视频。" },
            { q: "桌面版和网页版有什么区别？", a: "桌面版支持本地 AI 处理（更快、无限次、离线可用、隐私保护），是推荐的主要使用方式。网页版可在浏览器直接试用基础功能，无需安装。" },
            { q: "支持什么操作系统？", a: "目前支持 macOS（Apple Silicon 和 Intel）以及 Windows 10/11 64 位。Linux 版本即将推出。" },
            { q: "如何安装桌面版？", a: "访问下载页面选择对应系统版本。macOS 用户将 .dmg 文件中的 App 拖入 Applications 文件夹；Windows 用户双击 .exe 按向导安装。" },
            { q: "为什么 macOS 提示「无法验证开发者」？", a: "因为应用尚未通过 Apple 公证。请前往「系统设置 → 隐私与安全性」，在底部找到被拦截的提示，点击「仍要打开」。" },
            { q: "上传的音频会存储在云端吗？", a: "桌面版的 AI 处理完全在本地完成，你的音频不会离开你的电脑。网页版使用云端处理。" },
            { q: "如何升级到 Pro？", a: "访问定价页面，选择方案后使用信用卡自动续订，或使用支付宝单次充值。支持月付、季付和年付。" },
            { q: "Pro 订阅可以取消吗？", a: "可以随时在 Stripe 客户门户取消自动续订。取消后，当前付费周期结束时才失去 Pro 权益。" },
            { q: "支持的音频格式有哪些？", a: "目前支持 MP3 和 WAV 格式。更多格式支持正在开发中。" },
            { q: "遇到问题如何联系？", a: "请发送邮件至 support@biubiutab.com，我们会在 24 小时内回复。" },
          ].map((item, i) => (
            <details key={i} className="group border border-paper-300 rounded-xl bg-white">
              <summary className="px-6 py-5 cursor-pointer text-base font-serif tracking-wide text-ink-900 group-open:text-retro-green transition-colors select-none flex items-center justify-between">
                {item.q}
                <span className="text-ink-400 group-open:rotate-180 transition-transform text-xs">▼</span>
              </summary>
              <div className="px-6 pb-5 text-sm text-ink-700/70 leading-relaxed font-light tracking-wider">
                {item.a}
              </div>
            </details>
          ))}
        </section>

        <div className="mt-16 p-8 rounded-2xl border border-paper-300 bg-paper-50 text-center">
          <h2 className="font-serif text-xl text-ink-900 tracking-wide mb-3">还有其他问题？</h2>
          <p className="text-sm text-ink-700/60 mb-5">
            发送邮件至 <a href="mailto:support@biubiutab.com" className="text-retro-green hover:underline">support@biubiutab.com</a>
          </p>
          <Link
            href="/download"
            className="inline-flex items-center justify-center rounded-lg bg-retro-green px-8 py-3 text-sm tracking-widest text-paper-50 font-serif hover:bg-retro-green/90 transition-colors"
          >
            下载桌面版
          </Link>
        </div>

      </main>
    </div>
  );
}
