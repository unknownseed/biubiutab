# Biubiutab — 技术交接文档（最新版）

本文档面向接手开发的工程师，描述当前代码已实现能力、运行方式、数据流、关键模块、已知问题与下一步建议。

## 1. 项目目标（当前阶段）

当前实现的是一个 MVP：用户上传音频 → 异步分析 → 自动生成“和弦谱 + 结构 + 简谱（旋律数字谱）”并渲染为吉他六线谱谱例（alphaTab），支持导出 atex / PNG / PDF。

现阶段重点：

- 跑通端到端链路与基础交互
- 输出“可渲染的专业谱面”（不再是纯文本 6 线字符画）
- 为后续“质量提升 / 编辑 / 导出 GPX”打基础

## 2. 代码结构

- Web（Next.js + API 代理）：[apps/web](file:///Users/unknownseed/Developer/biubiutab/apps/web)
- AI 服务（FastAPI）：[services/ai](file:///Users/unknownseed/Developer/biubiutab/services/ai)
- 本地存储目录（运行时生成）：
  - 上传文件：`storage/uploads`

样本音频位于：`sample audio/`

## 3. 当前产品流程

1) 首页上传音频（MP3/WAV，≤ 50MB）  
2) Web 将文件落到本地 `storage/uploads`，并返回 `storedFilename`  
3) Web 调用 AI 服务创建任务 `/jobs`，传入 `audio_path`（本地文件绝对路径）  
4) 前端轮询 `/jobs/{id}` 直到 succeeded/failed  
5) succeeded 后获取 `/jobs/{id}/result`，其中包含 `key/tempo/sections/alphatex`  
6) Web 仅渲染 alphaTab 谱例（六线谱），并在谱例中展示：和弦、和弦按法图、段落、Key/拍号/速度、简谱（以歌词行形式显示在谱表下方）  
7) 支持复制/下载 alphaTex（.atex），并支持导出图片（PNG）与 PDF（打印）

## 4. 运行方式（本地开发）

### 4.1 启动 AI 服务

```bash
cd /Users/unknownseed/Developer/biubiutab/services/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

健康检查：

- `GET http://127.0.0.1:8001/health`

### 4.2 启动 Web

```bash
cd /Users/unknownseed/Developer/biubiutab/apps/web
npm install
AI_BASE_URL=http://127.0.0.1:8001 npm run dev -- --port 3000
```

打开：

- `http://localhost:3000`

### 4.3 Web 资源准备（AlphaTab 字体/音源）

Web 端的谱面播放（Practice Mode）依赖 AlphaTab 的 SoundFont 与 SMuFL 字体文件，来源为 NPM 依赖 `@coderline/alphatab`，构建时会自动复制到 `public/alphatab/`：

- 脚本：`apps/web/scripts/prepare-alphatab-assets.mjs`
- 触发：`apps/web/package.json` 的 `npm run dev/build/start`（以及 `postinstall`）
- 运行时静态路径：
  - `/alphatab/soundfont/sonivox.sf2`
  - `/alphatab/font/Bravura.woff2`

部署到 Render 如果使用了 `npm ci --ignore-scripts`，会跳过 `postinstall`；但只要构建命令为 `npm run build`，资源仍会在 build 阶段准备完成。

## 5. Web 端实现说明（Next.js）

### 5.1 页面

- 首页（上传 + 发起任务）：[page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/page.tsx)、[upload-client.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/upload-client.tsx)
- 编辑/导出页（渲染谱面）：[editor/[jobId]/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/editor/%5BjobId%5D/page.tsx)、[editor-client.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/editor-client.tsx)

### 5.2 Web API（Next.js Route Handlers）

上传：

- `POST /api/uploads`（multipart/form-data: file）  
  - 保存到：`storage/uploads/<uuid>.<ext>`
  - 校验：扩展名 mp3/wav + size ≤ 50MB  
  - 实现：[uploads/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/uploads/route.ts)

音频回放：

- `GET /api/uploads/:filename`  
  - 返回音频文件流（用于 `<audio controls>`）
  - 实现：[uploads/[filename]/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/uploads/%5Bfilename%5D/route.ts)

任务代理：

- `POST /api/jobs` → 转发到 AI `/jobs`（把 storedFilename 拼成绝对 audio_path）  
  - 实现：[jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts)
- `GET /api/jobs/:id` → 转发到 AI `/jobs/{id}`  
  - 实现：[jobs/[jobId]/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/route.ts)
- `GET /api/jobs/:id/result` → 转发到 AI `/jobs/{id}/result`  
  - 实现：[jobs/[jobId]/result/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/result/route.ts)

alphaTab 资源（字体/音源/脚本）：

- `apps/web` 构建时会把 `@coderline/alphatab` 的资源复制到 `apps/web/public/alphatab/`
- 运行时通过静态路径访问（部署更稳，避免生产环境读取 node_modules）：
  - `/alphatab/alphaTab.js`
  - `/alphatab/font/Bravura.woff2`
  - `/alphatab/soundfont/sonivox.sf2`

### 5.3 alphaTab 渲染

- 组件：[alphatab-viewer.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/alphatab-viewer.tsx)
- 设置要点：
  - `core.fontDirectory = "/alphatab/font/"`（字体来自 public/alphatab/font）
  - `core.scriptFile` 需要设置为带 origin 的绝对 URL（否则 Worker 内 `importScripts()` 会报 URL invalid）
  - `core.useWorkers = false`（避免某些环境下 worker 导致静默不渲染）
  - `player.enablePlayer = false`（当前不做 synth 播放）
  - `api.settings.notation.elements.set(NotationElement.EffectLyrics, true)`（强制显示 \lyrics，用于展示简谱）
  - 监听 `api.error` 显示错误并回退展示原始 alphatex

### 5.4 导出（PNG / PDF / SVG）

- 入口：编辑页按钮在 [editor-client.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/editor-client.tsx)
- 实现：通过 alphaTab 渲染结果的 SVG 进行导出：
  - PNG：将每页 SVG 光栅化为 PNG（2x scale），多页分别下载 `*_pN.png`
  - PDF：打开浏览器打印窗口，将每页 SVG 注入新窗口并分页打印（用户选择“保存为 PDF”）
  - SVG：内部工具方法支持逐页导出 svg（目前未在 UI 暴露按钮）

## 6. AI 服务实现说明（FastAPI）

### 6.1 API 合约（AI 服务）

- `GET /health` → `{ status: "ok" }`
- `POST /jobs`（body: `{ audio_path, title? }`）→ `{ id, status, progress, message?, error? }`
- `GET /jobs/{id}` → `{ id, status, progress, message?, error? }`
- `GET /jobs/{id}/result` → `{ title, artist?, key, tempo, time_signature, sections, alphatex }`

实现文件：[main.py](file:///Users/unknownseed/Developer/biubiutab/services/ai/main.py)

### 6.2 处理逻辑（当前：Audio → 和弦谱 + 结构 + 简谱 + 六线谱谱例）

核心函数位于 `_run_job()`，流程：

1) 读取音频：`librosa.load(audio_path, sr=None, mono=True)`
2) 速度检测：`librosa.beat.beat_track`（并做倍速/半速修正）
3) 调性估计：Krumhansl major/minor profile（更稳健）
4) 和弦分类（升级版）：`chroma_cqt` + 多种 chord template（maj/m/7/maj7/m7/sus2/sus4/dim/aug/add9），输出每小节一个和弦
5) 段落检测（MVP 规则）：Intro 前 4 小节；后续基于 4 小节 pattern 重复粗分 Verse/Chorus/Bridge
6) 旋律抽取：Basic Pitch 提取音符事件，按拍选取旋律候选，并转为简谱数字（1-7/#/b/-）
7) 生成 alphatex（六线谱 staff + 和弦按法图 + 段落文字 + 简谱 lyrics）

对应模块：

- 音频分析与和弦/调性：`services/ai/chord_detector.py`
- 段落检测：`services/ai/section_detector.py`
- 旋律抽取与简谱转换：`services/ai/melody_detector.py`
- 和弦按法图（含高把位 firstFret/barre 处理）：`services/ai/chord_shapes.py`
- 输出格式（alphaTex）：`services/ai/formatters.py`

### 6.3 依赖

AI 端 requirements：[requirements.txt](file:///Users/unknownseed/Developer/biubiutab/services/ai/requirements.txt)

- fastapi / uvicorn / pydantic
- basic-pitch（带 librosa/scipy/pretty-midi 等依赖）
  - 额外：librosa 固定在 requirements 里（用于 tempo/key/chroma）

## 7. 已知问题与现状解释

### 7.1 和弦不准/段落不准

这是当前阶段预期现象：和弦识别与段落识别为 MVP 简化算法，主要用于快速验证产品形态，尚未做到“商用级准确率”。常见影响因素：

- 完整混音（鼓/贝斯/键盘/人声同时存在）会让 chroma 被“非吉他和弦信息”污染
- 倍速/半速 BPM 误判会导致小节切分偏移，从而影响和弦
- 和弦分类仍是模板法（非深度学习分类器），对密集混音/复杂和声仍可能误判

### 7.2 简谱（旋律数字谱）显示注意

- 简谱通过 alphaTex 的 `\\lyrics` 渲染在谱表下方，内容来源是“旋律音高”而非歌词文本。
- 当前为按拍粒度的简谱（先保证出现与可读），后续可再做：按小节换行、八度点、时值/连线。

因此会出现“谱面看起来专业，但内容不靠谱”的情况。

### 7.3 alphaTab 字体加载失败

已处理：通过 `core.fontDirectory` + `/api/alphatab/font/*` 路由代理解决。

## 8. 后续迭代建议（按优先级）

### P0（优先做，直接提升可用性）

- 主旋律提取：从多音 note events 里抽取旋律线（或增加“只生成单音旋律”模式）
- 更稳健的节奏对齐：根据 onset/beat 做量化，而不是固定 8 分音符网格
- 指法约束：减少大跳把/不可能和弦；对同一时间点多音做可弹和弦筛选

### P1（提升质量）

- 源分离：把人声/鼓/伴奏分离，只对 guitar stem 进行转写（效果通常显著提升）
- 多轨/多声部：支持“主旋律 + 和弦伴奏”两轨输出

### P2（专业导出）

- 导出 GPX/GP5（或 MusicXML）而不仅是 AlphaTex
- 编辑器：基于 alphaTab 的 boundsLookup 做点击选中音符、改弦/品、增删、撤销重做

## 9. 常见排障

- 端口被占用：`EADDRINUSE`  
  - 查占用并 kill，或换端口；Web 侧用 `AI_BASE_URL` 指向 AI 服务端口
- AI 处理很慢/卡住  
  - Basic Pitch 推理耗时与音频长度相关；建议先用短音频验证流程
- 页面无谱但无明显报错  
  - 先确认 `/api/jobs/:id/result` 是否包含非空 `alphatex`
  - alphaTab viewer 会在渲染失败时显示错误与 alphatex 原文用于定位

## 10. 给产品/运营的非技术说明

### 10.1 这个版本“能做什么”

- 用户上传一段音频后，系统会自动生成一份可视化的吉他六线谱谱例（包含和弦标记、按法图、段落提示、简谱行），可在网页中查看。
- 支持导出：atex（可复现）、图片 PNG、PDF（打印）。

### 10.2 这个版本“做不到什么”（当前限制）

- 不能保证生成的每个音都正确：复杂编曲、混响大、鼓点强、多人声/多乐器混音会显著影响结果。
- 当前更像“自动生成初稿”：适合作为扒谱辅助，让用户用耳朵和播放器对照做二次修正。
- 复杂技巧（推弦、滑音、揉弦、泛音等）目前不稳定或不输出。
- 和弦/伴奏的可弹性与指法合理性仍需优化，可能出现不自然的和弦堆叠或跳把。

### 10.3 建议的使用场景（最容易成功）

- 单把吉他清晰录音（无鼓/无密集伴奏），或 Solo/旋律线明显的片段。
- 录音干净、混响少、背景噪音小的音频。
- 时长短的片段（例如 10~30 秒）更容易快速验证效果并减少“乱谱”概率。

### 10.4 不建议的使用场景（容易失败/乱谱）

- 完整商用混音歌曲（鼓、贝斯、键盘、人声同时存在），尤其是鼓点很强、压缩很重的音源。
- 现场录音、手机远场录音（环境噪音大、混响重）。
- 低频占比很高或大量失真（会导致模型输出大量“非目标音符”）。

### 10.5 上传格式建议

- 优先 WAV，其次 MP3。WAV 通常更稳定、误差更小。
- 采样率 44.1kHz/48kHz 均可；避免过低码率 MP3（更容易出现误检）。

### 10.6 “准确度”该如何对外表述（建议话术）

- 建议统一对外说法：  
  - “系统会自动生成谱面初稿（可视化六线谱），适合快速入门/辅助扒谱；复杂段落需要人工校对。”
- 避免在公开页面承诺“整首歌 80% 准确”，建议改成“片段级/主旋律更好”这类更符合现状的表述。

### 10.7 用户反馈收集建议（帮助快速迭代）

建议让用户在生成后提供三个维度反馈（尽量选择题）：

- 这段音频属于：单吉他/吉他+人声/完整混音/现场录音
- 你更关注：主旋律/和弦伴奏/两者都要
- 结果更像：可用初稿/需要大量修改/几乎不可用

这样能快速定位“模型转写问题”还是“指法映射与谱面表达问题”。
