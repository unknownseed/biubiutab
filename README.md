# Guitar Tab AI (MVP)

## 工程结构

- apps/web：Next.js 前端 + API 代理
- services/ai：FastAPI AI 服务（Basic Pitch 转 MIDI → 简单映射 → AlphaTex）
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

## API 合约（MVP）

- POST /api/uploads (multipart form-data: file) → { storedFilename, originalFilename, size }
- GET /api/uploads/:filename → 音频文件流
- POST /api/jobs { storedFilename, title? } → { id, status, progress, message? }
- GET /api/jobs/:id → { id, status, progress, message?, error? }
- GET /api/jobs/:id/result → { title, tuning, alphatex, tab_text? }
