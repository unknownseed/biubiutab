import Link from "next/link";

export default function DownloadPage() {
  return (
    <div className="flex-1 bg-white text-ink-700 font-sans selection:bg-retro-green/20">
      <main className="mx-auto flex w-full max-w-5xl flex-col px-[2rem] pb-[8rem]">

        <section className="flex flex-col items-center justify-center text-center gap-8 pt-24 pb-12">
          <span className="text-xs font-mono tracking-[0.3em] text-wood-400 uppercase border-b border-wood-400/30 pb-2">
            Desktop App
          </span>
          <h1 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
            下载 BiuBiu Tab
          </h1>
          <p className="text-lg text-ink-700 font-light tracking-wider max-w-lg leading-relaxed">
            免费下载桌面应用，AI 制谱不限次数，离线也能随心练习。
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="rounded-2xl border border-paper-300 bg-paper-50 p-8 lg:p-10 flex flex-col items-center text-center shadow-sm">
            <div className="text-5xl mb-6">🍎</div>
            <h2 className="text-2xl font-serif text-ink-900 tracking-wide mb-3">macOS</h2>
            <p className="text-sm text-ink-700/60 mb-8 leading-relaxed">
              Apple Silicon (M1/M2/M3/M4) 及 Intel 芯片<br />
              macOS 12 Monterey 或更高版本
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href="/downloads/BiuBiuTab-latest-arm64.dmg"
                className="block w-full rounded-lg bg-retro-green px-6 py-3.5 text-sm font-serif tracking-[0.2em] text-paper-50 text-center hover:bg-retro-green/90 transition-colors"
              >
                下载 Apple Silicon 版
              </a>
              <a
                href="/downloads/BiuBiuTab-latest-x64.dmg"
                className="block w-full rounded-lg border border-paper-300 bg-white px-6 py-3.5 text-sm font-serif tracking-[0.2em] text-ink-900 text-center hover:bg-paper-100 transition-colors"
              >
                下载 Intel 版
              </a>
            </div>
            <p className="mt-5 text-xs text-ink-700/40">当前版本：v0.2.0</p>
          </div>

          <div className="rounded-2xl border border-paper-300 bg-paper-50 p-8 lg:p-10 flex flex-col items-center text-center shadow-sm">
            <div className="text-5xl mb-6">🪟</div>
            <h2 className="text-2xl font-serif text-ink-900 tracking-wide mb-3">Windows</h2>
            <p className="text-sm text-ink-700/60 mb-8 leading-relaxed">
              64 位 Windows 10/11<br />
              推荐 8GB 以上内存
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href="/downloads/BiuBiuTab-latest-x64.exe"
                className="block w-full rounded-lg bg-retro-green px-6 py-3.5 text-sm font-serif tracking-[0.2em] text-paper-50 text-center hover:bg-retro-green/90 transition-colors"
              >
                下载 Windows 版
              </a>
            </div>
            <p className="mt-5 text-xs text-ink-700/40">当前版本：v0.2.0</p>
          </div>
        </section>

        <div className="w-full max-w-5xl h-px bg-wood-300/30 mx-auto my-8" />

        <section className="flex flex-col items-center text-center gap-6 py-8">
          <h2 className="text-xl font-serif text-ink-900 tracking-wide">安装指南</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl text-left">
            <div className="rounded-xl border border-paper-300 bg-white p-6">
              <h3 className="font-serif text-ink-900 mb-3">macOS</h3>
              <ol className="text-sm text-ink-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>下载 .dmg 文件并双击打开</li>
                <li>将 BiuBiu Tab 拖入 Applications 文件夹</li>
                <li>首次打开时，如提示「无法验证开发者」，请前往「系统设置 → 隐私与安全性」点击「仍要打开」</li>
              </ol>
            </div>
            <div className="rounded-xl border border-paper-300 bg-white p-6">
              <h3 className="font-serif text-ink-900 mb-3">Windows</h3>
              <ol className="text-sm text-ink-700 space-y-2 list-decimal list-inside leading-relaxed">
                <li>下载 .exe 安装程序并双击运行</li>
                <li>按安装向导完成安装</li>
                <li>若 Windows Defender 拦截，点击「更多信息 → 仍要运行」</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="w-full max-w-5xl h-px bg-wood-300/30 mx-auto my-8" />

        <section className="text-center py-8">
          <p className="text-sm text-ink-700/60 leading-relaxed">
            已有账号？<Link href="/login" className="text-retro-green hover:underline">登录管理订阅</Link>
          </p>
        </section>

      </main>
    </div>
  );
}
