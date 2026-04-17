# Biubiutab — 技术交接文档（最新版）

本文档面向接手开发的工程师，描述当前代码已实现能力、运行方式、核心功能模块、技术架构、已知问题与下一步建议。特别包含了近期关于“极简跟弹”模式、音频合成引擎以及移动端 App 打包的详尽记录。

## 1. 项目目标与已实现成果

当前项目已经从初期的“文本六线谱生成器”进化为一个**功能完整的在线吉他谱浏览器与练习工具**。

### 核心业务链路：
1. 用户上传音频（MP3/WAV）。
2. 后端（FastAPI + AI 算法）异步分析音频，提取和弦、小节、BPM、调性、歌词，并生成标准的 **GP5（Guitar Pro 5）** 格式文件。
3. 前端（Next.js）轮询获取结果，并使用 **AlphaTab** 渲染出专业级的六线谱。
4. 提供两种核心视图：
   - **完整六线谱**：标准的吉他谱阅读模式，支持导出 PNG、PDF 和 GP5 文件。
   - **极简跟弹（Practice Mode）**：专为视奏和练习打造的动态交互模式。

### “极简跟弹”模式核心特性：
- **实时滚动歌词**：随音乐进度高亮并滚动。
- **大字号和弦图**：当前小节和弦的指法图实时放大显示。
- **和弦时间轴（Chord Timeline）**：
  - 直观展示全曲和弦走向，点击即可精准跳转（Seek）。
  - **Chordify 风格节拍细分**：时间轴采用“一拍一格”的精细显示方式，同名和弦使用圆点标记代替文字，每个小节首拍增加粗线分割，极大增强了读谱时的节拍感与段落感。
- **A-B 智能循环**：用户可设定循环区间，系统会自动将 A、B 边界“吸附（Snap）”到最近的和弦块起止点，保证循环的音乐完整性。
- **高级播放控制**：支持 0.5x - 1.5x 变速（自动计算并显示实时 BPM）、半音级移调（Transpose）。
- **预拍倒数（Count-in）**：播放前提供符合当前 BPM 的 4 拍视觉倒数与节拍器滴答声（Metronome tick）。
- **极简 UI 布局**：针对屏幕第一屏（First Fold）进行了高度压缩和优化，确保六根琴弦及所有操作按钮均可见，无需滚动。

---

## 2. 代码结构

- Web（Next.js + React + TailwindCSS）：`apps/web`
  - 核心播放器组件：`src/components/PracticeMode.tsx`, `PlaybackControls.tsx`, `ChordTimeline.tsx`, `SyncedLyrics.tsx`, `LargeChordDiagram.tsx`
  - AlphaTab 渲染器封装：`src/components/alphatab-viewer.tsx`
  - 高级音频引擎（Tone.js）：`src/components/GuitarSampler.ts`
- AI 服务（FastAPI）：`services/ai`
  - 核心生成逻辑：`gp_generator.py`（负责将 AI 分析结果打包为二进制的 GP5 文件）。
- 静态资源：`apps/web/public/alphatab/`（包含字体与 SoundFont 音色库）。

---

## 3. 音频发声引擎架构（重点交接）

为了解决网页端吉他播放“电子 MIDI 味”过重的问题，我们目前设计了两套音频引擎方案：

### 方案 A：AlphaTab 内置 TinySynth + 高品质 SF2（当前默认启用）
- **实现方式**：我们使用了著名的开源轻量级 General MIDI 音色库 `TimGM6mb.sf2`（约 5.8MB）。
- **优势**：完美兼容 AlphaTab 的极简合成器，加载快，木吉他（Program 25）的声音清脆自然，比原版强很多。无需额外写发声逻辑，AlphaTab 原生支持所有吉他技巧（推弦、滑音等）。
- **注意**：为了确保发声，后端 `gp_generator.py` 中强制将吉他轨道的乐器（Program）设置为了 25。

### 方案 B：Tone.js + 高清真实采样（终极音质方案，已写好代码预留）
- **实现方式**：在 `PracticeMode.tsx` 顶部有一个 `USE_TONE_JS` 的常量开关。当设为 `true` 时，AlphaTab 会被静音（设为 `MidiEventsOnly`），由 `GuitarSampler.ts` 接管所有发声。
- **优势**：突破浏览器 MIDI 合成器限制，可以加载几十 MB 的录音棚级别真实吉他单音切片（WAV/MP3），音质上限极高。支持自定义 Reverb（混响）和 Compressor（压缩）。
- **下一步工作**：如果决定启用此方案，接手人需要准备 6~8 个干净的吉他单音录音文件（如 E2.mp3, A2.mp3 等），放入 `public/samples/guitar/` 目录中。同时需要针对滑音、击勾弦等特殊事件在 `playedBeatChanged` 监听器中编写单独的参数包络逻辑（详见交接讨论记录）。

---

## 4. 移动端 App（iOS/iPad）打包与上架指南

当前的前端架构（Next.js + Web Audio）非常适合通过“套壳”方式打包为 iOS App。

### 推荐技术栈
- **Capacitor** 或 **Ionic**（将现有的 Web 产物装载到原生 WKWebView 中）。

### App Store 审核合规要点（必读）
苹果不允许“纯网页快捷方式”上架。为了顺利通过审核，壳 App 必须具备**最小原生体验（Minimum Native Functionality）**：
1. **原生文件导入**：接入 iOS 的 `UIDocumentPicker`，允许用户从“文件”App 或微信分享导入音频。
2. **本地离线缓存**：利用原生能力或 Service Worker，将 5MB 的音色库和已生成的谱例缓存到本地，实现“无网可练”。
3. **原生分享导出**：使用原生 Share Sheet 导出生成的 GP5 或 PDF 谱子。
4. **音频策略规避**：iOS 严格限制自动播放。当前的“点击播放按钮才开始预拍和发声”的逻辑已经符合规范，请务必保持，切勿尝试在页面加载时自动播放。
5. **支付合规**：如需收费，必须接入 Apple IAP（内购），绝不能在 App 内放置跳转到网页的支付宝/微信支付链接。

---

## 5. 本地开发与运行方式

### 5.1 启动 AI 服务 (后端)
```bash
cd /Users/unknownseed/Developer/biubiutab/services/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
健康检查：`GET http://127.0.0.1:8001/health`

### 5.2 启动 Web 服务 (前端)
```bash
cd /Users/unknownseed/Developer/biubiutab/apps/web
npm install
npm run dev
```

---

## 6. 后续迭代建议与已知问题

### UI/UX 体验
- AlphaTab 在某些极端宽度下，SVG 的换行计算可能会导致右侧少量留白。已通过 CSS 负边距做了尽可能的修复，如果更换容器宽度，需要重新微调 `transform: translateY`。
- 极简跟弹模式在手机竖屏（Mobile Portrait）下的空间非常极限，目前已经做了大量的折叠优化（如隐藏 BPM 数字等），后续可以考虑在小屏幕强制要求用户横屏（Landscape）使用。

### AI 算法与扒谱准确度
- 当前的算法依然是 MVP 级别。对于重型混音、鼓点密集、或含有复杂键盘伴奏的歌曲，和弦和段落识别可能出现误判。
- **BPM 测算优化**：已修复 librosa 在某些常规曲速下产生“双倍速/半速”误判的逻辑（现在的算法更贴合真实弹唱节奏，阈值设为 50-160 BPM 之间不折叠）。
- **建议**：后续可以引入源分离算法（Source Separation，如 Spleeter/Demucs），先将音频中的“吉他 / 人声”轨道抽离，再进行和弦分析，准确率会有质的飞跃。

### 谱面编辑能力
- 目前生成的 GP5 是只读的。AlphaTab 提供了强大的 `boundsLookup` 功能，允许获取用户点击的音符/和弦位置。后续可以基于此开发“网页端谱面编辑器”，允许用户手动修正 AI 扒错的音符。