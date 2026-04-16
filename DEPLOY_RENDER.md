## Render 部署清单（Web）

### 1) 构建命令（推荐）

在 Render Web Service 配置：

- Root Directory: `apps/web`
- Build Command: `npm ci --ignore-scripts && npm run build`
- Start Command: `npm run start`

说明：

- 即使 `npm ci --ignore-scripts` 跳过 `postinstall`，`npm run build` 仍会执行 `prepare:alphatab`，保证生成 `public/alphatab/`

### 2) 必备环境变量

- `AI_BASE_URL`：指向 AI 服务（例如 Render 上的另一个 Service URL，或内网 URL）

### 3) 部署后自检（必须过）

浏览器打开站点后，Network 里确认以下请求为 200：

- `https://<your-domain>/alphatab/alphaTab.js`
- `https://<your-domain>/alphatab/font/Bravura.woff2`
- `https://<your-domain>/alphatab/soundfont/sonivox.sf2`

### 4) 常见报错与对应处理

#### A. `Failed to execute 'importScripts' ... URL is invalid`

原因：

- AlphaTab 播放器会在 Worker 里 `importScripts(core.scriptFile)`，如果 `core.scriptFile` 是相对路径（例如 `/api/...`），在 `blob:` Worker 场景下会被判定为 invalid

处理：

- 确保 `core.scriptFile` 设置为带 origin 的绝对 URL（例如 `new URL('/alphatab/alphaTab.js', window.location.href).toString()`）

#### B. 资源 404（字体/音源/脚本）

原因：

- `public/alphatab/` 没有生成或没有被部署

处理：

- 确保构建命令包含 `npm run build`（不要只做 `next build`）
- 确保 build 阶段会运行 `prepare:alphatab`

