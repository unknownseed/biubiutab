# 桌面端（B：纯静态 UI）迁移清单（逐页 / 逐接口）

目标：从 `apps/web`（Next.js App Router + `/api/*`）迁移到“纯静态 UI + Electron + 本地 AI（127.0.0.1:8001）+ Supabase（browser）登录/订阅”，桌面端第一版仅包含【生成 + 编辑】。

## 0. 总体原则

- 不再依赖 Next.js 服务器能力：不使用 `src/app/api/**`、不使用 middleware、不可依赖 server actions
- UI 侧直接调用：
  - 本地 AI：`http://127.0.0.1:8001`
  - Supabase：browser client（anon key + RLS），仅做登录/订阅/用量读取
- 任何需要 service role 的操作（例如 Stripe webhook 写订阅表）留在云端（Vercel/Cloud），桌面端绝不内置 service role
- 桌面端第一版只做两页：
  - 生成页（Play / Upload）
  - 编辑页（Editor）

## 1. 页面迁移（逐页）

### 1.1 生成页（来源：PlayPage）
- 来源文件：
  - [play/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/play/page.tsx)
  - [upload-client.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/upload-client.tsx)
- 迁移目标：
  - 新静态路由：`/play`（或 `/` 直接就是生成页）
  - 复用 `UploadClient` 的 UI/状态机逻辑
- 必改点（关键）：
  1. 把所有 `fetch("/api/…")` 改为调用“桌面端本地 endpoint”：
     - 原：`POST /api/upload-url`、`PUT R2`、`POST /api/jobs`、`GET /api/jobs/:id`
     - 新：不走 Next `/api`，改为：
       - 本地文件：直接把本地文件路径交给 AI（推荐新增 AI endpoint 支持 file path 或 multipart 上传）
       - URL 输入：仍可 `POST http://127.0.0.1:8001/jobs`（storage_provider=url）
  2. 上传到 R2 的逻辑（预签名）在桌面端第一版先不做（可后续做云端同步）。
  3. 登录检查：
     - 原逻辑：服务端 `/api/*` 会 401
     - 新逻辑：UI 用 supabase browser client 判断 session；未登录则提示并跳转 `/login`
- 依赖组件可直接复用：
  - TimelineViewer、ToastProvider、进度 stepLabel 等

### 1.2 编辑页（来源：EditorPage / EditorClient）
- 来源文件：
  - [editor/[jobId]/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/editor/%5BjobId%5D/page.tsx)
  - [editor-client.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/editor-client.tsx)
- 迁移目标：
  - 新静态路由：`/editor/:jobId`
  - 复用 AlphaTabViewer / PracticeMode UI（如暂时不做练习模式，可先只保留 full score）
- 必改点（关键）：
  1. 把 `fetch("/api/jobs/...")` 改成 `fetch("http://127.0.0.1:8001/jobs/...")`
     - 原：`GET /api/jobs/:jobId`
     - 新：`GET http://127.0.0.1:8001/jobs/:jobId`
  2. GP5 下载：
     - 原：`GET /api/jobs/:jobId/gp5?level=…`
     - 新：`GET http://127.0.0.1:8001/jobs/:jobId/result.gp5?level=…`
  3. Result JSON：
     - 原：`GET /api/jobs/:jobId/result`
     - 新：`GET http://127.0.0.1:8001/jobs/:jobId/result`
  4. 返回按钮路由：
     - 原：`/play`
     - 新：保留 `/play` 即可

### 1.3 登录页（桌面端需要，但可做极简）
- 当前来源（Next）：[login/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/login/page.tsx) + server actions
- 迁移目标（静态）：
  - 新静态路由：`/login`
  - 用 supabase browser client 直接调用：
    - `supabase.auth.signInWithPassword`
    - `supabase.auth.signUp`
- 必改点：
  - 移除 server action `apps/web/src/app/login/actions.ts`
  - 登录成功后前端路由跳转 `/play`
- UI 可复用：
  - 大部分表单 UI 结构可照搬

### 1.4 顶部导航（可选，桌面端可极简）
- 当前来源：[navbar.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/components/navbar.tsx)
- 迁移建议：
  - 桌面端第一版只保留：
    - “生成”
    - “退出登录”
  - 不保留 Learn/Pricing/Dashboard 等入口（后续加）

## 2. 接口迁移（逐接口）

### 2.1 jobs
- Next 现有（需要移除依赖）：
  - [api/jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts)
  - [api/jobs/[jobId]/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/route.ts)
  - [api/jobs/[jobId]/result/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/result/route.ts)
  - [api/jobs/[jobId]/gp5/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/gp5/route.ts)
  - [api/jobs/[jobId]/audio/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/audio/route.ts)（桌面端可选，音频本地播放）
- 桌面端目标：
  - 统一改成直连本地 AI 同名接口：
    - `POST http://127.0.0.1:8001/jobs`
    - `GET http://127.0.0.1:8001/jobs/:id`
    - `GET http://127.0.0.1:8001/jobs/:id/result`
    - `GET http://127.0.0.1:8001/jobs/:id/result.gp5?level=…`
- 补充（推荐新增 AI 能力以支持桌面端）：
  - 支持本地文件输入：
    - 方案 A：`POST /jobs` 支持 multipart 上传文件
    - 方案 B：`POST /jobs` 支持 `audio_path=/absolute/path/to/file`（仅本地安全环境）

### 2.2 ai/health
- Next 现有：[api/ai/health/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/ai/health/route.ts)
- 桌面端目标：
  - UI 直接 `GET http://127.0.0.1:8001/health`
  - HealthProvider 改为 polling 本地地址（用于提示“AI 未启动”）

### 2.3 upload-url / uploads / R2
- Next 现有：
  - [api/upload-url/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/upload-url/route.ts)
  - [api/uploads/*](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/uploads)
- 桌面端第一版建议：
  - 暂不做 R2 上传（避免增加云端成本与复杂度）
  - 使用本地文件路径或 multipart 上传到本地 AI

### 2.4 stripe/*（云端保留，不进桌面端）
- Next 现有：
  - [stripe/webhook/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/stripe/webhook/route.ts)
  - [stripe/checkout/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/stripe/checkout/route.ts)
- 桌面端第一版：
  - 不内置支付流程（可后续用外部浏览器打开支付页）
  - webhook 继续放云端（Vercel）

### 2.5 subscriptions（桌面端读）
- 现有 server helper（Next）：[subscriptions.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/lib/subscriptions.ts)
- 桌面端目标：
  - 不使用 server client
  - 前端直接用 supabase browser client 读：
    - `subscriptions`（status/plan_type/current_period_end）
    - `ai_jobs` 用量统计（RLS 保护）

## 3. 需要新增/调整的本地 AI 接口（建议）

### 3.1 本地文件输入
桌面端核心：让用户选择本地文件就能生成。
- 推荐新增：
  - `POST /jobs/upload` -> 返回 `audio_path`（本地临时路径）或直接创建 job
  - 或在 `POST /jobs` 支持 multipart：
    - field：`file`
    - optional：`title`
- 这样 UI 不需要自己处理文件路径兼容与权限问题

### 3.2 CORS
- 本地静态 UI（file:// 或 http://127.0.0.1）调用本地 AI，需要 AI 开 CORS（只允许本地 origin）

## 4. 桌面端骨架（下一步任务 m2）
- 新增 `apps/desktop-ui`（Vite/React + 路由 + Supabase browser auth + 直连本地 AI）
- 新增 Electron 主进程：
  - 启动本地 AI（子进程）
  - 启动静态 UI（加载 file:// 或本地静态 server）
  - 管理端口与进程生命周期

