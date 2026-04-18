import Link from "next/link";
import Image from "next/image";

export default function MarketingPage() {
  return (
    <div className="flex-1 bg-paper-100 text-ink-700 font-sans selection:bg-amber-400/30 overflow-hidden">
      <main className="mx-auto flex w-full max-w-5xl flex-col px-[2rem] pb-[8rem]">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center gap-[4rem] min-h-screen relative">
          <div className="absolute inset-0 pointer-events-none -z-10 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center grayscale opacity-30 mix-blend-multiply"></div>
        
        {/* Subtle background element */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-30 mix-blend-multiply">
            <div className="w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,#A67C52_0%,transparent_70%)] blur-3xl"></div>
          </div>

          <div className="z-10 flex flex-col gap-8 max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif italic tracking-widest leading-relaxed text-ink-800 animate-fade-in-up">
              万物皆有裂痕，<br className="hidden md:block"/>那是光照进来的地方。
            </h1>
            <p className="mt-2 text-sm text-wood-400 font-serif tracking-widest animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              —— Leonard Cohen
            </p>
            <div className="mt-12 text-lg text-ink-700/70 font-sans font-light flex flex-col gap-2 tracking-[0.15em] animate-fade-in-up" style={{ animationDelay: "400ms" }}>
              <p>听见那些藏在风里的旋律。</p>
              <p>将流动的音频，<br/>凝固成指尖的刻痕。</p>
            </div>
          </div>

          <div className="z-10 mt-[3rem] animate-fade-in-up" style={{ animationDelay: "600ms" }}>
            <Link 
              href="/play" 
              className="inline-flex items-center justify-center px-12 py-5 text-lg tracking-[0.3em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none animate-breathe group"
            >
              <span className="transition-transform duration-500 group-hover:translate-x-2">
                [ 拾起旋律 ]
              </span>
            </Link>
          </div>
          
          <div className="absolute bottom-8 animate-breathe text-wood-300/50 font-light text-sm tracking-widest">
            ↓
          </div>
        </section>

        {/* Concept Section */}
        <section className="flex flex-col items-center text-center gap-[4rem] py-36">
          <h2 className="text-3xl font-serif text-ink-900 tracking-widest">不必完美，但要真诚。</h2>
          <div className="text-lg text-ink-700/80 leading-[2] font-sans font-light flex flex-col gap-8 tracking-wide max-w-lg mx-auto">
            <p>我们理解每一首民谣背后的呼吸。</p>
            <p>不仅是和弦的准确，更是节奏的起伏。</p>
            <p>为每一位吉他拾荒者，</p>
            <p>找回那些想弹却抓不住的瞬间。</p>
          </div>
        </section>

        {/* Features Section - AI Transcription */}
        <section className="flex flex-col md:flex-row items-center gap-[4rem] py-[4rem]">
          <div className="flex-1 flex flex-col justify-center gap-8">
            <h2 className="text-2xl font-serif text-ink-900 tracking-widest border-b border-wood-300/30 pb-4 inline-block w-max">一首歌的旅程</h2>
            <div className="text-base text-ink-700/70 leading-loose font-light flex flex-col gap-6 tracking-wide">
              <p>上传一段旋律，<br/>AI 会听见你听见的，<br/>甚至听见你没留意的。</p>
              
              <ul className="flex flex-col gap-4 mt-4">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-wood-400"></span>
                  <span>剥离人声的呼吸</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-wood-400"></span>
                  <span>对齐时光的节拍</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-wood-400"></span>
                  <span>为副歌编配扫弦</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-wood-400"></span>
                  <span>凝固成一首完整的谱</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[400px] border border-paper-300 bg-paper-200 p-4 group overflow-hidden">
            <div className="w-full h-full min-h-[400px] relative grayscale-[40%] contrast-75 opacity-90 transition-all duration-[3s] group-hover:grayscale-0 group-hover:scale-105 rounded-sm overflow-hidden">
              <Image 
                src="/images/feature-ai.jpg" 
                alt="Audio waveform" 
                fill 
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <div className="w-16 h-px bg-wood-300/50 mx-auto my-28" />

        {/* Features Section - Practice Mode */}
        <section className="flex flex-col md:flex-row-reverse items-center gap-[4rem] py-[4rem]">
          <div className="flex-1 flex flex-col justify-center gap-8">
            <h2 className="text-2xl font-serif text-ink-900 tracking-widest border-b border-wood-300/30 pb-4 inline-block w-max">像呼吸一样自然</h2>
            <div className="text-base text-ink-700/70 leading-loose font-light flex flex-col gap-6 tracking-wide">
              <p>当音乐流淌，<br/>和弦在指尖自然切换。<br/>不必低头翻谱，<br/>抬头，跟着光走。</p>
              
              <ul className="flex flex-col gap-4 mt-4">
                <li className="flex items-center gap-3 text-ink-700/80">
                  <span className="text-wood-400">·</span>
                  <span>一拍一格，呼吸可见</span>
                </li>
                <li className="flex items-center gap-3 text-ink-700/80">
                  <span className="text-wood-400">·</span>
                  <span>歌词随风，逐字点亮</span>
                </li>
                <li className="flex items-center gap-3 text-ink-700/80">
                  <span className="text-wood-400">·</span>
                  <span>指法放大，一目了然</span>
                </li>
                <li className="flex items-center gap-3 text-ink-700/80">
                  <span className="text-wood-400">·</span>
                  <span>变速不变调，慢慢来</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[400px] border border-paper-300 bg-ink-950 p-4 shadow-2xl rounded-sm group overflow-hidden">
            <div className="w-full h-full min-h-[400px] relative opacity-90 transition-all duration-[3s] group-hover:opacity-100 group-hover:scale-105 rounded-sm overflow-hidden">
              <Image 
                src="/images/feature-practice.jpg" 
                alt="Guitar strings and dust" 
                fill 
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <div className="text-center my-28 text-wood-300/40 text-lg">◇</div>

        {/* Study Module */}
        <section className="flex flex-col items-center justify-center py-[4rem] gap-16">
          <div className="text-center flex flex-col gap-6">
            <h2 className="text-3xl font-serif tracking-widest text-ink-900">手指与灵魂的磨合</h2>
            <p className="text-ink-700/60 font-light tracking-widest leading-loose">
              从第一个和弦到完整的弹唱，<br/>每一步，都有人陪你。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
            {[
              { title: "右手的律动", subtitle: "节奏与扫弦", img: "/images/study-1.jpg" },
              { title: "指尖的记忆", subtitle: "音阶与指法", img: "/images/study-2.jpg" },
              { title: "听觉的觉醒", subtitle: "乐理与听力", img: "/images/study-3.jpg" },
              { title: "和声的色彩", subtitle: "常用进行", img: "/images/study-4.jpg" },
              { title: "经典的传承", subtitle: "弹唱金曲", img: "/images/study-5.jpg" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-4 group cursor-pointer">
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-200">
                  <Image 
                    src={item.img} 
                    alt={item.title} 
                    fill 
                    className="object-cover grayscale-[20%] transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink-800 tracking-wider">{item.title}</h3>
                  <p className="font-sans text-sm text-ink-700/60 mt-1">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button className="text-wood-400 text-sm tracking-widest border-b border-transparent hover:border-wood-300 transition-all duration-500 pb-1">
              [ 开始你的旅程 → ]
            </button>
          </div>
        </section>

        <div className="w-16 h-px bg-wood-300/50 mx-auto my-28" />

        {/* AI Assistant Section */}
        <section className="flex flex-col items-center justify-center text-center py-[4rem] gap-12">
          <div className="text-center flex flex-col gap-6">
            <p className="text-ink-700/80 font-light tracking-widest leading-loose text-lg">
              那些关于琴弦的困惑，<br/>总有人为你轻声解答。
            </p>
          </div>

          <div className="w-full max-w-lg bg-paper-200 border border-paper-300 p-8 flex flex-col gap-8 text-left shadow-sm">
            <div className="flex flex-col gap-2 self-end max-w-[80%]">
              <div className="bg-wood-400/10 p-4 text-sm text-ink-800 font-light tracking-wide leading-relaxed rounded-sm border border-wood-400/20">
                为什么 F 和弦这么难按？
              </div>
            </div>
            <div className="flex flex-col gap-2 self-start max-w-[90%]">
              <div className="p-4 text-sm text-ink-700 font-light tracking-wide leading-relaxed">
                F 和弦需要食指横按全部六根弦，这是大横按技巧的一道坎。
                <br/><br/>
                不要灰心，你可以先从简化版的 Fmaj7 开始，只需要按 4 根弦。等手指的力量慢慢建立起来，再尝试完整的大横按。
              </div>
            </div>
            
            <div className="mt-4 pt-6 border-t border-paper-300 text-center">
              <button className="text-wood-400 text-sm tracking-widest hover:text-wood-500 transition-colors duration-300">
                [ 问一个问题 ]
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
