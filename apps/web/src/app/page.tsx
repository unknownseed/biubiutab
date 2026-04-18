import Link from "next/link";
import Image from "next/image";

export default function MarketingPage() {
  return (
    <div className="flex-1 bg-white text-ink-700 font-sans selection:bg-amber-400/30 overflow-hidden">
      <main className="mx-auto flex w-full max-w-5xl flex-col px-[2rem] pb-[8rem]">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center gap-[4rem] min-h-screen relative">
          
          <div className="z-10 flex flex-col gap-8 max-w-5xl w-full px-4">
            <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-serif italic tracking-widest leading-relaxed text-ink-800 animate-fade-in-up whitespace-nowrap text-center">
              “万物皆有裂痕，那是光照进来的地方。”
            </h1>
            <p className="mt-2 text-sm text-wood-400 font-serif tracking-widest animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              —— Leonard Cohen
            </p>
            <div className="mt-12 text-lg text-ink-700 font-sans font-light flex flex-col gap-2 tracking-[0.15em] animate-fade-in-up" style={{ animationDelay: "400ms" }}>
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
                [ BiuBiu 弹唱 ]
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
          <div className="text-lg text-ink-700 leading-[2] font-sans font-light flex flex-col gap-8 tracking-wide max-w-lg mx-auto">
            <p>我们理解每一首民谣背后的呼吸。</p>
            <p>不仅是和弦的准确，更是节奏的起伏。</p>
            <p>为每一位吉他拾荒者，</p>
            <p>找回那些想弹却抓不住的瞬间。</p>
          </div>
          <div className="mt-8">
            <Link 
              href="#" 
              className="inline-flex items-center justify-center px-12 py-5 text-sm tracking-[0.2em] text-paper-50 font-serif bg-wood-500 border border-wood-500 transition-colors duration-500 hover:bg-paper-100 hover:text-wood-500 hover:border-wood-500 rounded-none group"
            >
              <span className="transition-transform duration-500 group-hover:translate-x-1">
                [ 注册会员 ]
              </span>
            </Link>
          </div>
        </section>

        {/* Features Section - AI Transcription */}
        <section className="relative w-[100vw] ml-[50%] -translate-x-1/2 bg-[#FAFAFA] py-32 border-y border-paper-300/50">
          <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row items-stretch gap-16 px-6 lg:px-12">
            
            {/* Content Left */}
            <div className="flex-1 flex flex-col justify-center gap-12 lg:pr-12">
              <div className="flex flex-col gap-6">
                <span className="text-xs font-mono tracking-[0.2em] text-wood-400 uppercase">AI TRANSCRIPTION</span>
                <h2 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
                  AI 编配
                </h2>
                <div className="h-px w-24 bg-wood-400/30"></div>
              </div>
              
              <div className="text-lg text-ink-700 leading-relaxed font-light flex flex-col gap-8 tracking-wide">
                <p className="text-xl text-ink-800">
                  上传一段旋律，<br/>
                  AI 会听见你听见的，<br/>
                  甚至听见你没留意的。
                </p>
                
                <ul className="flex flex-col gap-6 mt-4">
                  {[
                    { id: "01", text: "剥离人声的呼吸" },
                    { id: "02", text: "对齐时光的节拍" },
                    { id: "03", text: "为副歌编配扫弦" },
                    { id: "04", text: "凝固成完整的谱" }
                  ].map((item) => (
                    <li key={item.id} className="flex items-start gap-6 group cursor-default">
                      <span className="font-mono text-sm text-wood-400/50 transition-colors duration-300 group-hover:text-wood-400 pt-1">
                        {item.id}
                      </span>
                      <span className="text-lg text-ink-700 transition-colors duration-300 group-hover:text-ink-900">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-4">
                  <Link 
                    href="/play" 
                    className="inline-flex items-center justify-center px-10 py-4 text-sm tracking-[0.2em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none group"
                  >
                    <span className="transition-transform duration-500 group-hover:translate-x-1">
                      [ BiuBiu编配 ]
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Image Right */}
            <div className="flex-[1.2] w-full relative min-h-[500px] lg:min-h-[600px] bg-paper-200 group overflow-hidden">
              <div className="absolute inset-0 grayscale-[20%] contrast-[0.9] opacity-90 transition-all duration-[2s] group-hover:grayscale-0 group-hover:scale-105">
                <Image 
                  src="/images/feature-ai.jpg" 
                  alt="Audio waveform transcription" 
                  fill 
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
              </div>
              {/* Decorative overlay frame */}
              <div className="absolute inset-4 border border-white/20 pointer-events-none mix-blend-overlay"></div>
            </div>
          </div>
        </section>

        {/* Features Section - Practice Mode */}
        <section className="relative w-[100vw] ml-[50%] -translate-x-1/2 py-32">
          <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row-reverse items-stretch gap-16 px-6 lg:px-12">
            
            {/* Content Right */}
            <div className="flex-1 flex flex-col justify-center gap-12 lg:pl-12">
              <div className="flex flex-col gap-6">
                <span className="text-xs font-mono tracking-[0.2em] text-wood-400 uppercase">PRACTICE MODE</span>
                <h2 className="text-4xl lg:text-5xl font-serif text-ink-900 tracking-wide leading-tight">
                  BiuBiu跟练
                </h2>
                <div className="h-px w-24 bg-wood-400/30"></div>
              </div>
              
              <div className="text-lg text-ink-700 leading-relaxed font-light flex flex-col gap-8 tracking-wide">
                <p className="text-xl text-ink-800">
                  当音乐流淌，和弦在指尖自然切换。<br/>
                  不必低头翻谱，抬头，跟着光走。
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10 mt-4">
                  {[
                    { title: "一拍一格", desc: "呼吸可见的节奏律动" },
                    { title: "歌词随风", desc: "逐字点亮的演唱指引" },
                    { title: "指法放大", desc: "一目了然的按弦提示" },
                    { title: "降速练习", desc: "变速不变调，慢慢来" }
                  ].map((feature, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-1 bg-wood-400 rounded-full"></div>
                        <h4 className="text-base font-serif text-ink-900 tracking-wider">{feature.title}</h4>
                      </div>
                      <p className="text-sm text-ink-700/70 font-sans pl-4">{feature.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Link 
                    href="/play" 
                    className="inline-flex items-center justify-center px-10 py-4 text-sm tracking-[0.2em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none group"
                  >
                    <span className="transition-transform duration-500 group-hover:translate-x-1">
                      [ BiuBiu跟练 ]
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Image Left */}
            <div className="flex-[1.2] w-full relative min-h-[500px] lg:min-h-[600px] bg-ink-950 group overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-80 transition-all duration-[2s] group-hover:opacity-100 group-hover:scale-105">
                <Image 
                  src="/images/feature-practice.jpg" 
                  alt="Guitar practice mode interface" 
                  fill 
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
              </div>
              {/* Decorative overlay frame */}
              <div className="absolute inset-4 border border-white/10 pointer-events-none"></div>
            </div>
          </div>
        </section>

        <div className="text-center my-28 text-wood-300/40 text-lg">◇</div>

        {/* Study Module */}
        <section className="flex flex-col items-center justify-center py-[4rem] gap-16">
          <div className="text-center flex flex-col gap-6">
            <h2 className="text-3xl font-serif tracking-widest text-ink-900">手指与灵魂的磨合</h2>
            <p className="text-ink-700 font-light tracking-widest leading-loose">
              从第一个和弦到完整的弹唱，<br/>每一步，都有人陪你。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto">
            {[
              { title: "右手的律动", subtitle: "节奏与扫弦", img: "/images/study-1.jpg" },
              { title: "指尖的记忆", subtitle: "音阶与指法", img: "/images/study-2.jpg" },
              { title: "和声的色彩", subtitle: "常用进行", img: "/images/study-4.jpg" },
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
                  <p className="font-sans text-sm text-ink-700 mt-1">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link 
              href="#" 
              className="inline-flex items-center justify-center px-10 py-4 text-sm tracking-[0.2em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none group"
            >
              <span className="transition-transform duration-500 group-hover:translate-x-1">
                [ 开始你的旅程 ]
              </span>
            </Link>
          </div>
        </section>

        <div className="w-16 h-px bg-wood-300/50 mx-auto my-28" />

        {/* AI Assistant Section */}
        <section className="flex flex-col items-center justify-center text-center py-[4rem] gap-12">
          <div className="text-center flex flex-col gap-6">
            <p className="text-ink-700 font-light tracking-widest leading-loose text-lg">
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
            
            <div className="mt-8 pt-8 border-t border-paper-300 text-center">
              <Link 
                href="#" 
                className="inline-flex items-center justify-center px-10 py-4 text-sm tracking-[0.2em] text-paper-50 font-serif bg-retro-green border border-retro-green transition-colors duration-500 hover:bg-paper-100 hover:text-retro-green hover:border-retro-green rounded-none group"
              >
                <span className="transition-transform duration-500 group-hover:translate-x-1">
                  [ 问一个问题 ]
                </span>
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
