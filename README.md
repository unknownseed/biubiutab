# Biubiutab (MVP)

## 工程结构

- apps/web：Next.js 前端 + API 代理
- services/ai：FastAPI AI 服务（和弦/调性/结构/简谱 → AlphaTex）
- storage/uploads：本地上传文件目录（运行时自动创建）

## 本地运行

1) 启动 AI 服务

```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

2) 启动 Web

```bash
cd apps/web
npm install
AI_BASE_URL=http://127.0.0.1:8001 npm run dev
```

打开 http://localhost:3000

## 部署要求（Render）

- Web 端谱面播放依赖 AlphaTab 自带的 SoundFont（`sonivox.sf2`）与字体文件（Bravura），来源为 NPM 依赖 `@coderline/alphatab`
- `apps/web` 会在 `npm run dev/build/start`（以及 `postinstall`）阶段把这些资源复制到 `apps/web/public/alphatab/`，运行时通过静态路径访问：
  - `/alphatab/soundfont/sonivox.sf2`
  - `/alphatab/font/Bravura.woff2`
- Render 构建如果使用了 `npm ci --ignore-scripts`，虽然会跳过 `postinstall`，但只要构建命令是 `npm run build`（默认），资源仍会在 build 阶段准备完成
- AlphaTab 播放器内部会在 Worker 里 `importScripts(core.scriptFile)`，因此 `core.scriptFile` 必须是带 origin 的绝对 URL，否则会报 URL invalid 导致播放不可用

## API 合约（MVP）

- POST /api/uploads (multipart form-data: file) → { storedFilename, originalFilename, size }
- GET /api/uploads/:filename → 音频文件流
- POST /api/jobs { storedFilename, title? } → { id, status, progress, message? }
- GET /api/jobs/:id → { id, status, progress, message?, error? }
- GET /api/jobs/:id/result → { title, key, tempo, time_signature, sections, alphatex }
