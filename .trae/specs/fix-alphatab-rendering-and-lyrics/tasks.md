# Tasks

- [x] Task 1: 修复 Python 歌词占位符
  - [x] SubTask 1.1: 将 `services/ai/intro_transcriber.py` 中的 `\\xa0` 替换为真正的 Unicode 不换行空格字面量（`\xa0`）。
  - [x] SubTask 1.2: 将 `services/ai/rhythm_patterns.py` 中的 `\\xa0` 替换为真正的 Unicode 不换行空格字面量（`\xa0`）。

- [x] Task 2: 完善字体 API 路由
  - [x] SubTask 2.1: 在 `apps/web/src/app/api/alphatab/font/[filename]/route.ts` 中增强跨域与 Content-Type 处理。
  - [x] SubTask 2.2: 在 API 路由中添加详细的加载与找不到字体的控制台日志输出。

- [x] Task 3: 优化 AlphaTab Viewer 组件渲染机制
  - [x] SubTask 3.1: 在 `apps/web/src/components/alphatab-viewer.tsx` 中实现 `preloadFonts` 函数。
  - [x] SubTask 3.2: 引入初始化延时（`setTimeout`）以等待字体可用。
  - [x] SubTask 3.3: 增强原有的 `maybeRetryOnBottomY` 或 API error 回调，在重试时给予递增延时并输出明确的 `console.error`。
