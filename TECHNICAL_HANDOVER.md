# Biubiutab 技术交接文档 (Technical Handover)

## 项目简介
Biubiutab 是一个音频转吉他谱的 Web 应用。用户上传 MP3/WAV 音频文件后，系统通过后端的音频分析算法 Pipeline 识别歌曲的段落、和弦、节奏、人声旋律和歌词，最终在前端使用 AlphaTab 将其渲染为可交互、可播放的吉他谱（包含和弦图、TAB 谱、歌词等）。

## 技术栈与 Pipeline 架构
* **前端 (Frontend):** Next.js (App Router), React, Tailwind CSS, TypeScript
* **谱面渲染 (Score Rendering):** AlphaTab (v1.8.2)
* **后端 (Backend API):** Next.js Route Handlers
* **AI/DSP 处理服务 (Python FastAPI):**
  * **音源分离 (Source Separation):** `demucs` / `spleeter` (用于提取人声、伴奏、打击乐等 stem)
  * **节拍与小节检测 (Beat/Downbeat Tracking):** `madmom` (基于 RNN 的节拍跟踪，精度远高于传统 DSP)
  * **和弦识别 (Chord Recognition):** `librosa` / `madmom` (结合 CQT  chromagram 与 Viterbi 解码)
  * **结构与段落分析 (Music Structure Analysis):** `librosa` (基于自相似性矩阵与聚类算法，划分 Intro, Verse, Chorus 等)
  * **人声旋律提取 (Vocal Melody Extraction):** `crepe` 或基于音高追踪的算法 (如 pYIN/YIN)
  * **语音识别与对齐 (ASR & Forced Alignment):** `faster-whisper` (用于高精度歌词转写) 结合 MFA (Montreal Forced Aligner) 或 Whisper 的词级时间戳，将歌词精确对齐到小节与节拍。
* **部署 (Deployment):** Vercel (前端) / Render 或拥有 GPU 支持的云服务器 (Python 后端)

## 核心架构与工作流

1. **上传阶段 (`apps/web/src/components/upload-client.tsx`)**
   * 用户拖拽或选择音频文件 (限制 50MB，支持 mp3/wav)。
   * 上传过程中显示进度条，UI 进入锁定状态。
   * 文件上传到 Next.js API `/api/uploads`。

2. **核心 AI 处理 Pipeline (`apps/web/src/app/api/jobs/route.ts` & Python 后端)**
   * 上传完成后，Next.js 创建一个处理任务 (Job)。
   * Python 后端接管音频文件，按顺序执行深度分析 Pipeline：
     * **Step 1: 音源分离** - 提取纯人声与伴奏。
     * **Step 2: 节拍检测 (`madmom`)** - 建立全局 Beat Grid (小节与拍子时间戳)。
     * **Step 3: 和弦识别** - 在伴奏 stem 上运行，并将其量化对齐到 Beat Grid。
     * **Step 4: 段落划分** - 分析整首歌的结构，标记 Intro, Verse, Chorus 等。
     * **Step 5: 旋律与歌词转写 (`faster-whisper`)** - 提取歌词，获取词级时间戳，并结合人声旋律线将其映射到具体的拍子 (Beat) 上。
   * 期间前端通过轮询 `/api/jobs/[jobId]` 获取实时进度和当前处理步骤。

3. **谱面生成 (`services/ai/formatters.py` & `rhythm_patterns.py`)**
   * Python 后端将 Pipeline 分析结果整合，转换为 AlphaTex 格式 (AlphaTab 的文本谱面描述语言)。
   * **节奏型动态分配:** 根据段落名称 (Intro/Verse/Chorus) 和音频能量 (Energy)，动态分配不同的吉他伴奏节奏型：
     * `Intro` / `Outro`: 低能量，使用分解和弦 (Arpeggio) 表现，如 `fingerpick_8th` 或 `fingerpick_4th`。
     * `Verse`: 中等能量，使用基础民谣扫弦 (如 `folk_basic` 8分扫弦)。
     * `Chorus`: 高能量，使用密集的 16分扫弦 (如 `pop_16th`)。
   * **特殊处理:** 为了规避 AlphaTab 的渲染 Bug，去除了 `slashed` 扫弦记号与和弦图同时出现时的崩溃问题；去除了简谱数字和扫弦方向提示，保持谱面整洁。

4. **前端渲染 (`apps/web/src/components/alphatab-viewer.tsx`)**
   * 获取到生成的 AlphaTex 字符串后，前端交由 AlphaTab 引擎渲染为 SVG。
   * **降级策略:** 如果由于复杂的排版导致 AlphaTab 渲染失败，系统内置了重试和降级机制 (去除内联歌词 -> 去除所有文本特效 -> 仅保留基础音符)，以确保用户至少能看到基础谱面。
   * **全局修复:** 在传入 AlphaTab 之前，强制移除了所有的 `\slashed` 标记，彻底解决了和弦图与扫弦记号共存时的致命崩溃 Bug (IntersectionObserver 触发的 bottomY undefined 错误)。

## 目录结构
```text
biubiutab/
├── apps/
│   └── web/                   # Next.js 前端应用
│       ├── src/
│       │   ├── app/           # 页面路由与 API (Next.js App Router)
│       │   │   ├── api/       # 后端接口 (上传、任务轮询)
│       │   │   ├── editor/    # 谱面编辑/展示页
│       │   │   └── page.tsx   # 首页 (含 Leonard Cohen 诗句)
│       │   └── components/    # React 组件
│       │       ├── alphatab-viewer.tsx # AlphaTab 谱面渲染器
│       │       └── upload-client.tsx   # 上传与状态展示组件
│       ├── public/            # 静态资源
│       └── package.json
└── services/
    └── ai/                    # Python 音频处理服务
        ├── main.py            # FastAPI 入口 (Pipeline 控制器)
        ├── formatters.py      # AlphaTex 组装逻辑
        ├── rhythm_patterns.py # 节奏型库与分配策略
        ├── intro_transcriber.py # 前奏听音转写
        ├── audio_preprocess.py  # 能量计算等
        ├── chord_detector.py    # 和弦识别模块
        ├── melody_detector.py   # 旋律分析
        ├── section_detector.py  # 段落结构分析
        ├── source_separation.py # 音源分离
        └── vocal_analysis.py    # faster-whisper 歌词转写与对齐
```

## 最近重要修改记录 (Recent Fixes)

1. **AlphaTab 渲染崩溃修复 (`alphatab-viewer.tsx`)**
   * **现象:** 当谱面同时包含和弦图 (`ch`) 和扫弦记号 (`slashed`) 时，发生二次排版（如窗口缩放或可见性检测）会导致引擎报 `bottomY undefined` 致命错误，导致谱面全白。
   * **解决:** 在把 AlphaTex 交给引擎前，执行全局替换 `out.replace(/\bslashed\b/g, "")`，彻底根除崩溃，同时完美保留了和弦图和歌词的显示。

2. **动态节奏型分配 (`rhythm_patterns.py` & `formatters.py`)**
   * **现象:** 所有段落的伴奏千篇一律。
   * **解决:** 扩展了 `STRUMMING_PATTERNS` 字典，加入了 `is_arpeggio` 属性用于区分分解和弦与扫弦。修改 `select_pattern` 函数，根据 `section_name` 动态调整能量值：Intro/Outro 降级为分解和弦 (显示具体的弦位数字 0.4, 0.3 等)，Chorus 升级为 16 分密集扫弦。

3. **谱面视觉纯净度优化 (`rhythm_patterns.py` & `intro_transcriber.py`)**
   * **现象:** 谱面上有不必要的扫弦方向 (v/^) 和多余的简谱数字。
   * **解决:** 移除了向 AlphaTex 注入 `lyrics 1 "v"` 等扫弦方向代码；移除了简谱数字的注入；仅保留正常的歌词显示 (`lyrics "text"`)。

4. **UI/UX 优化 (`page.tsx` & `upload-client.tsx`)**
   * **首页:** 替换了文案，采用居中排版和斜体，加入了 Leonard Cohen 的名言“万物皆有裂痕，那是光照进来的地方。”。
   * **上传框:** 在开始上传或处理阶段 (`status === "uploading" || "processing"`)，隐藏拖拽区域和选择按钮，使界面更加专注和清爽。

## 待办与已知问题 (TODO & Known Issues)

* **AlphaTab 引擎升级:** 目前移除 `slashed` 是针对 AlphaTab v1.8.2 的权宜之计。未来如果 AlphaTab 修复了该布局 Bug，可以考虑恢复 `slashed` 记号，以获得更真实的扫弦视觉效果。
* **节奏型丰富度:** 当前只有 5 种基础节奏型，未来可以根据更多的音频特征 (如 Groove, Swing) 扩展节奏库。
