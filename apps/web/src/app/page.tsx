import Link from "next/link";
import Image from "next/image";

export default function MarketingPage() {
  return (
    <div className="flex-1 bg-[#F9F7F2] text-[#2F4F4F] font-sans selection:bg-[#FFBF00]/30 overflow-hidden">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-[4rem] px-[2rem] pb-[8rem] pt-[8rem]">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center gap-[4rem] py-[8rem] min-h-[70vh] relative border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] rounded-none">
          {/* Subtle background element */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-10">
            <div className="w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,#A67C52_0%,transparent_70%)] blur-3xl"></div>
          </div>

          <div className="z-10 flex flex-col gap-8 max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif tracking-widest leading-relaxed text-[#2F4F4F]">
              万物皆有裂痕，<br className="hidden md:block"/>那是光照进来的地方。
            </h1>
            <div className="text-lg text-[#2F4F4F]/70 font-light flex flex-col gap-2 tracking-widest">
              <p>听见那些藏在风里的旋律。</p>
              <p>Biubiutab，将流动的音频，凝固成指尖的刻痕。</p>
            </div>
          </div>

          <div className="z-10 mt-[2rem]">
            <Link 
              href="/play" 
              className="inline-flex items-center justify-center px-12 py-5 text-lg tracking-[0.3em] text-[#F9F7F2] bg-[#2F4F4F] border border-[#2F4F4F] transition-colors duration-500 hover:bg-[#F9F7F2] hover:text-[#2F4F4F] hover:border-[#A67C52] group rounded-none"
            >
              <span className="transition-transform duration-500 group-hover:translate-x-2">
                [ 拾起旋律 ]
              </span>
            </Link>
          </div>
          
          <div className="absolute bottom-8 animate-bounce text-[#A67C52]/50 font-light text-sm tracking-widest">
            向下滚动
          </div>
        </section>

        {/* Concept Section */}
        <section className="flex flex-col md:flex-row items-stretch gap-[4rem] py-[4rem]">
          <div className="flex-1 flex flex-col justify-center gap-10 border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] p-[4rem] rounded-none">
            <h2 className="text-3xl font-serif text-[#2F4F4F] tracking-widest">不必完美，<br/>但要真诚。</h2>
            <div className="text-base text-[#2F4F4F]/70 leading-loose font-light flex flex-col gap-6 tracking-wide">
              <p>我们理解每一首民谣背后的呼吸。不仅是和弦的准确，更是节奏的起伏。</p>
              <p>为每一位吉他拾荒者，找回那些想弹却抓不住的瞬间。</p>
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[400px] border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] p-4 rounded-none group overflow-hidden">
            <div className="w-full h-full relative grayscale-[40%] contrast-75 opacity-90 transition-all duration-[3s] group-hover:grayscale-0 group-hover:scale-105">
              <Image 
                src="https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=1000&q=80" 
                alt="Guitar strings and dust" 
                fill 
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-[4rem]">
          <div className="flex flex-col gap-6 border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] p-[3rem] rounded-none hover:border-[#A67C52]/50 transition-colors duration-500">
            <h3 className="text-xl font-serif text-[#2F4F4F] tracking-widest border-b border-[rgba(166,124,82,0.1)] pb-4">和弦识别</h3>
            <p className="text-sm text-[#2F4F4F]/70 font-light leading-loose tracking-wide">
              捕捉那些转瞬即逝的共鸣。无论多微弱的扫弦，都能被精准镌刻在时间轴上。
            </p>
          </div>
          
          <div className="flex flex-col gap-6 border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] p-[3rem] rounded-none hover:border-[#A67C52]/50 transition-colors duration-500">
            <h3 className="text-xl font-serif text-[#2F4F4F] tracking-widest border-b border-[rgba(166,124,82,0.1)] pb-4">跟弹模式</h3>
            <p className="text-sm text-[#2F4F4F]/70 font-light leading-loose tracking-wide">
              像呼吸一样自然，让手指找到它的归宿。大字号和弦、平滑滚动，无需分心，专注当下。
            </p>
          </div>

          <div className="flex flex-col gap-6 border border-[rgba(166,124,82,0.1)] bg-[#F9F7F2] p-[3rem] rounded-none hover:border-[#A67C52]/50 transition-colors duration-500">
            <h3 className="text-xl font-serif text-[#2F4F4F] tracking-widest border-b border-[rgba(166,124,82,0.1)] pb-4">AI 助教</h3>
            <p className="text-sm text-[#2F4F4F]/70 font-light leading-loose tracking-wide">
              那些关于琴弦的困惑，总有人为你轻声解答。手指与灵魂的磨合，从此不再孤单。
            </p>
          </div>
        </section>

        {/* Study Module Teaser */}
        <section className="flex flex-col items-center justify-center text-center py-[8rem] gap-8 bg-[#F9F7F2] border border-[rgba(166,124,82,0.1)] rounded-none">
          <div className="text-[#A67C52] opacity-80">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif tracking-widest text-[#2F4F4F]">手指与灵魂的磨合</h2>
          <p className="text-[#2F4F4F]/50 font-light text-sm tracking-[0.2em] mt-4 border border-[rgba(166,124,82,0.2)] px-6 py-2">
            学习模块 · 即将开启
          </p>
        </section>

      </main>
    </div>
  );
}
