import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full py-[4rem] flex flex-col items-center justify-center gap-6 bg-ink-900 border-t border-paper-300">
      <div className="text-center my-8 text-paper-100/40 text-lg">◇</div>
      <p className="text-sm text-paper-100/40 font-serif italic tracking-widest">
        愿琴声熄灭时，故事还在。
      </p>
      <div className="flex flex-col items-center gap-6 mt-8 text-xs text-paper-100/30 font-light tracking-wider">
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:text-paper-100/60 transition-colors">首页</Link>
          <span>·</span>
          <Link href="/features" className="hover:text-paper-100/60 transition-colors">功能</Link>
          <span>·</span>
          <Link href="/download" className="hover:text-paper-100/60 transition-colors">下载</Link>
          <span>·</span>
          <Link href="/pricing" className="hover:text-paper-100/60 transition-colors">价格</Link>
          <span>·</span>
          <Link href="/support" className="hover:text-paper-100/60 transition-colors">支持</Link>
        </div>
        <p>Biubiutab · 拨动心弦</p>
        <p>© 2026</p>
      </div>
    </footer>
  );
}
