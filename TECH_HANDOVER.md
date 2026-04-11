# Guitar Tab AI — 技术交接文档（截至目前）

本文档面向接手开发的工程师，描述当前代码已实现能力、运行方式、数据流、关键模块、已知问题与下一步建议。

## 1. 项目目标（当前阶段）

当前实现的是一个 MVP 骨架：用户上传音频 → 异步转写 → 生成可渲染的专业谱面（alphaTab）→ 支持下载/复制（alphaTex）。

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
5) succeeded 后获取 `/jobs/{id}/result`，其中包含 `alphatex`  
6) Web 使用 alphaTab 渲染 `alphatex` 为专业谱面（SVG）  
7) 支持复制/下载 `alphatex`（.atex）

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

alphaTab 字体资源代理（解决 Font not available / NetworkError）：

- `GET /api/alphatab/font/:filename`  
  - 从 `node_modules/@coderline/alphatab/dist/font/` 读取并返回
  - 实现：[alphatab/font route](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/alphatab/font/%5Bfilename%5D/route.ts)

### 5.3 alphaTab 渲染

- 组件：[alphatab-viewer.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/alphatab-viewer.tsx)
- 设置要点：
  - `core.fontDirectory = "/api/alphatab/font/"`（否则字体 404）
  - `core.useWorkers = false`（避免某些环境下 worker 导致静默不渲染）
  - `player.enablePlayer = false`（当前不做 synth 播放）
  - 监听 `api.error` 显示错误并回退展示原始 alphatex

## 6. AI 服务实现说明（FastAPI）

### 6.1 API 合约（AI 服务）

- `GET /health` → `{ status: "ok" }`
- `POST /jobs`（body: `{ audio_path, title? }`）→ `{ id, status, progress, message?, error? }`
- `GET /jobs/{id}` → `{ id, status, progress, message?, error? }`
- `GET /jobs/{id}/result` → `{ title, tuning, alphatex, tab_text? }`

实现文件：[main.py](file:///Users/unknownseed/Developer/biubiutab/services/ai/main.py)

### 6.2 处理逻辑（当前）

核心函数位于 `_run_job()`，流程：

1) Basic Pitch 转写：`basic_pitch.inference.predict(audio_path, ...)`
2) 从返回的 `midi_data` 提取 note events（start/end/pitch/velocity）
3) 用 librosa 做 tempo 估计（`librosa.beat.beat_track`），并对 BPM 做 50~220 的钳制
4) 简化映射：把 notes 按时间网格（当前为 8 分音符粒度）量化到 beat step，生成 alphaTex
5) pitch→(string,fret) 映射：
   - 标准调弦 E2-A2-D3-G3-B3-E4
   - 0~5 品优先、同音更粗弦优先（用 score 近似）
   - 超出吉他可弹范围（E2~E4+24品）的 pitch 会被过滤（避免任务失败）

注意：目前输出的是“可渲染谱面”，但音乐性/准确度仍较粗，需要后续算法迭代。

### 6.3 依赖

AI 端 requirements：[requirements.txt](file:///Users/unknownseed/Developer/biubiutab/services/ai/requirements.txt)

- fastapi / uvicorn / pydantic
- basic-pitch（带 librosa/scipy/pretty-midi 等依赖）

## 7. 已知问题与现状解释

### 7.1 生成结果“乱”

这是当前阶段预期现象：Basic Pitch 会对整段混音音频做多音转写，会包含伴奏/人声/鼓点谐波等，映射阶段还没有做：

- 主旋律提取/声部选择
- 节奏/小节精确对齐
- 和弦识别与可弹指法优化（动态规划）
- 源分离（分离 guitar stem）

因此会出现“谱面看起来专业，但内容不靠谱”的情况。

### 7.2 “Pitch 101 cannot be mapped…”

已处理：当前会过滤超出吉他范围的 pitch，避免任务失败；同时在 predict 参数中限制频率范围，减少异常高音。

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

- 用户上传一段音频后，系统会自动生成一份可视化的吉他谱（六线谱+节奏排版），可在网页中查看并下载。
- 输出的是可被 alphaTab 渲染的谱面数据（AlphaTex），外观更接近“专业谱面”，便于后续做编辑、导出等能力。

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
