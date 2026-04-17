import * as Tone from 'tone';

export class GuitarSampler {
  private sampler: Tone.Sampler | null = null;
  public isReady = false;

  constructor() {
    this.init();
  }

  private async init() {
    // -------------------------------------------------------------
    // 【非常重要】这就是你需要准备的吉他音频切片！
    // 请将它们放在 apps/web/public/samples/guitar/ 文件夹下。
    //
    // 原理：
    // 1. Tone.js 会自动使用高品质变调算法来填补你没有提供的那些音高。
    // 2. 为了保证声音不变形，建议【每隔三四个半音】就录制一个干净的单音切片。
    // 3. 例如你可以只提供吉他的 6 根空弦，以及高把位的几个音，这就能覆盖 90% 的场景！
    // 4. 切片越干净（不带空间混响、无底噪），拼接出来的效果越好！
    // -------------------------------------------------------------
    this.sampler = new Tone.Sampler({
      urls: {
        "E2": "/samples/guitar/E2.mp3", // 6弦空弦
        "A2": "/samples/guitar/A2.mp3", // 5弦空弦
        "D3": "/samples/guitar/D3.mp3", // 4弦空弦
        "G3": "/samples/guitar/G3.mp3", // 3弦空弦
        "B3": "/samples/guitar/B3.mp3", // 2弦空弦
        "E4": "/samples/guitar/E4.mp3", // 1弦空弦
        "A4": "/samples/guitar/A4.mp3", // 1弦5品
        "D5": "/samples/guitar/D5.mp3", // 1弦10品
      },
      // 声音自然衰减的尾巴
      release: 1.5,
      onload: () => {
        this.isReady = true;
        console.log("Tone.js 原声吉他采样器已加载！");
      }
    });

    // 为了让干巴巴的切片听起来像在录音棚里弹出来的
    // 我们在这里加一个微弱的混响效果器 (Reverb)
    const reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.1,
    }).toDestination();
    
    // 再加一个压缩器 (Compressor)，让吉他扫弦和分解的声音力度更平衡
    const compressor = new Tone.Compressor(-12, 3).connect(reverb);

    // 把我们的吉他音色接入效果器链
    this.sampler.connect(compressor);
  }

  // iOS Safari / Chrome 要求必须由用户手势触发才能激活音频上下文
  public async startAudioContext() {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  }

  // 播放指定的 MIDI 音高 (比如 60 = 中央 C)
  public playNote(midiValue: number, velocity: number = 0.8) {
    if (!this.isReady || !this.sampler) return;
    
    // 把数字转换成音名，比如 60 -> "C4"
    const noteName = Tone.Frequency(midiValue, "midi").toNote();
    
    // 立即发声
    this.sampler.triggerAttack(noteName, Tone.now(), velocity);
  }

  // 停止指定音高的发声 (模拟手掌捂住琴弦)
  public stopNote(midiValue: number) {
    if (!this.isReady || !this.sampler) return;
    const noteName = Tone.Frequency(midiValue, "midi").toNote();
    this.sampler.triggerRelease(noteName, Tone.now());
  }

  // 停掉所有声音
  public stopAll() {
    if (!this.isReady || !this.sampler) return;
    this.sampler.releaseAll(Tone.now());
  }
}
