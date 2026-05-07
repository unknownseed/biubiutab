# 桌面端（本地生成 + 云端轻服务）方案文档

## 目标与约束

### 目标
- 桌面端第一版：只支持“生成 + 编辑（Editor）”，并可导出 GP5
- 生成过程默认在本地完成（demucs/分析/生成），保证 6 分钟内出谱的产品体验，并向用户展示进度
- 云端仅保留轻服务：登录、订阅状态、用量统计（不承载重算力）
- 后续再引入“保护策略 / 云端能力”，但不影响本地可用性

### 不做（第一版）
- 云端加速（后续再加）
- Learn/教学库/练习等非核心页面（可复用现有页面与组件，暂不纳入桌面端第一版交付）

## 总体架构

### 组件拆分
- 桌面端壳：Electron（Mac 优先，Windows 后续）
- 本地 AI 服务：`services/ai`（FastAPI），启动后监听 `127.0.0.1:8001`
- 本地 UI：纯静态 UI（选择 B 方案）
  - UI 通过 HTTP 调用本地 AI（`127.0.0.1:8001`）
  - UI 通过 Supabase（anon key + RLS）完成登录/订阅状态读取
- 云端：Supabase（Auth + DB），以及可选的 Stripe webhook（仅做订阅表更新）

### 数据流（生成）
1. 用户在桌面端 UI 选择音频文件
2. UI 调用本地 AI：`POST /jobs`
3. AI 立即返回 `jobId` 并异步执行
4. UI 轮询本地 AI：`GET /jobs/{jobId}`，展示进度与步骤
5. 完成后 UI 下载结果：`GET /jobs/{jobId}/result.gp5?level=...` 或 `GET /jobs/{jobId}/result`
6. UI 进入 Editor 展示与导出

### 数据流（登录/订阅）
1. UI 使用 Supabase Browser Client 登录（Auth）
2. UI 从 `subscriptions`、`ai_jobs`（或同类表）读取订阅状态与用量（依赖 RLS）
3. 桌面端可根据订阅状态决定是否显示 Pro 功能入口（不涉及云端算力）

## 本地 UI 形式（选择 B：纯静态 UI）

### 为什么选择 B
- 安装后体验更接近“原生桌面应用”：无须额外管理本地 Next.js server 端口/进程
- 故障面更小：减少 Node 服务端运行时引入的崩溃/端口冲突
- 更适合长期：后续做自动更新与跨平台打包时结构更清晰

### 代价与迁移点
- 现有 Next.js App Router 的 server routes（`/api/*`）不能直接复用，需要迁移到：
  - 直接调用本地 AI（桌面端）
  - 或由桌面端主进程提供本地桥接 API（可选）
- 原来依赖 Next middleware / SSR 的鉴权与会话逻辑，需要改为“纯客户端 Supabase 会话”

## 桌面端第一版范围（仅生成 + 编辑）

### 页面范围
- 登录页（Supabase Auth）
- 生成页（上传/URL/选择文件）
- Editor 页（加载 jobId、拉取 gp5、渲染与导出）

### 进度体验要求
- 必须显示：
  - 当前步骤（queued/demucs/hpss/analysis/lyrics/melody/sections/generate/done 等）
  - 进度百分比（0-100）
  - 错误提示（失败原因 + 建议动作）
- 允许用户离开页面，再回来仍能看到同一 job 的进度（本地持久化可后续加）

## 现有成果是否还能用

### 直接复用（价值最大）
- AI 端核心能力：`services/ai` 及其整个生成流水线（demucs/分析/gp5 生成/进度）
- GP5 生成与编辑展示：
  - AlphaTab 相关前端组件
  - Editor 页面的大部分渲染逻辑（改为直连本地 AI）
- Supabase 数据结构与订阅逻辑（概念与表结构仍可用）

### 需要迁移/改写（但逻辑可复用）
- Next.js 的 `/api/*`：需要改为桌面端直连本地 AI 与 Supabase
- Next middleware 相关的 session 刷新/保护路由：改为前端路由守卫（客户端判断 session）
- 目前为云端节省成本做的低资源开关：
  - 桌面端默认不启用低资源模式
  - 云端若保留 AI（仅做保底/health）时才启用

### 仍然可保留在云端（轻服务）
- Stripe webhook（用于写入 `subscriptions` 表）
- 管理自检接口与运维工具（仅云端用，不进入桌面端）

## 后续（完成产品后）再做的保护策略方向
- 把最值钱的模型/训练参数转为云端推理服务（API），客户端永远不下发权重
- 本地负责通用计算与渲染，云端负责“精修/评分/增强”
- 订阅与风控用于限制滥用

## 风险与对策（MVP 阶段）
- 依赖体积大（demucs/whisper/basic-pitch）：做按需下载与缓存、版本管理
- 跨平台依赖（ffmpeg/libsndfile）：Mac 先行，Windows 后续补齐打包策略
- 桌面端不可存放 service role：所有敏感写操作必须走 RLS 或云端 webhook

