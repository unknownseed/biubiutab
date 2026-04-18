export default function Footer() {
  return (
    <footer className="w-full py-[4rem] flex flex-col items-center justify-center gap-6 bg-ink-900 border-t border-paper-300">
      <div className="text-center my-8 text-paper-100/40 text-lg">◇</div>
      <p className="text-sm text-paper-100/40 font-serif italic tracking-widest">
        愿琴声熄灭时，故事还在。
      </p>
      <div className="flex flex-col items-center gap-4 mt-8 text-xs text-paper-100/30 font-light tracking-wider">
        <p>Biubiutab · 拨动心弦</p>
        <p>© 2026</p>
        <div className="flex items-center gap-6 mt-4">
          <a href="#" className="hover:text-paper-100/60 transition-colors">关于我们</a>
          <span>·</span>
          <a href="#" className="hover:text-paper-100/60 transition-colors">联系</a>
          <span>·</span>
          <a href="#" className="hover:text-paper-100/60 transition-colors">隐私政策</a>
        </div>
      </div>
    </footer>
  );
}
