# 修复 AlphaTab 渲染与歌词显示 Spec

## Why
当前 `alphatab-viewer.tsx` 在渲染包含歌词的 AlphaTex 时，因为缺少字体预加载机制和延时初始化，导致底层布局计算找不到锚点（触发 `bottomY` undefined 错误）。此外，后端的 AlphaTex 生成时误用了被转义的 `\\xa0`（应该使用字面量的 `\xa0` 或者 Unicode 不换行空格），引发了 AlphaTex 解析错误（`Error parsing alphaTex`）。这些问题导致用户在上传特定歌曲（如《Let It Be》）时，前端白屏或显示渲染失败。

## What Changes
- 修复 Python 代码中的 `\\xa0` 字符串为真正的 `\xa0`（不换行空格字面量）。
- 在 `alphatab-viewer.tsx` 中添加 `preloadFonts` 方法，在初始化 API 前预加载必需字体。
- 在前端增加对 `bottomY` 错误的递增延迟重试机制，并在字体加载完成后延迟渲染谱面。
- 增强 `app/api/alphatab/font/[filename]/route.ts` 字体 API 路由的健壮性和日志输出，确保字体可以被正常访问。

## Impact
- Affected specs: AlphaTab Viewer 组件、Python 后端歌词对齐格式化
- Affected code:
  - `apps/web/src/components/alphatab-viewer.tsx`
  - `apps/web/src/app/api/alphatab/font/[filename]/route.ts`
  - `services/ai/intro_transcriber.py`
  - `services/ai/rhythm_patterns.py`

## MODIFIED Requirements
### Requirement: 稳健的 AlphaTab 渲染
系统必须在 AlphaTab 初始化前预加载必需字体（如 `Bravura.woff2` 和 `robotoslab-regular-webfont.woff2`），并在 `bottomY` 错误发生时具备自动重试能力，确保复杂排版（如歌词与简谱叠加）能成功渲染。

### Requirement: AlphaTex 语法正确性
系统在生成空白占位歌词时，必须输出合法的不换行空格字符（`\xa0`），避免触发 AlphaTex 解析引擎的崩溃。
