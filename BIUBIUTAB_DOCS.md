# BiuBiu Tab — 技術與功能文檔

> 版本：`v1.3` ｜ 最後更新：2026-05-23 ｜ 維護倉庫：`github.com/unknownseed/biubiutab`

BiuBiu Tab 是一款 **AI 吉他製譜與教學桌面應用**，搭配官方介紹網站。使用者可上傳音頻或 YouTube 連結，經由本地 AI 自動生成 Guitar Pro 5 (.gp5) 吉他譜，並在桌面端進行跟彈練習與模組化教學。

---

## 目錄

1. [產品架構](#1-產品架構)
2. [Marketing 官網](#2-marketing-官網)
3. [Desktop 桌面應用](#3-desktop-桌面應用)
4. [AI 服務](#4-ai-服務)
5. [資料庫與存儲](#5-資料庫與存儲)
6. [環境變數總表](#6-環境變數總表)
7. [部署](#7-部署)
8. [成本結構](#8-成本結構)
9. [後續可做事項](#9-後續可做事項)

---

## 1. 產品架構

```
┌──────────────────────────────────────────────────────────┐
│                    BiuBiu Tab                             │
│                                                          │
│  ┌───────────────┐   ┌──────────────────┐                │
│  │  Marketing     │   │  Desktop App     │                │
│  │  Website       │   │  (Electron)      │                │
│  │  (Next.js)     │   │                  │                │
│  │                │   │  ┌────────────┐  │                │
│  │  /             │   │  │ UI (React) │  │                │
│  │  /features     │   │  └─────┬──────┘  │                │
│  │  /pricing      │   │        │         │                │
│  │  /download     │   │  ┌─────▼──────┐  │                │
│  │  /support      │   │  │ IPC Proxy  │  │                │
│  │  /learn        │   │  └─────┬──────┘  │                │
│  │  /dashboard    │   │        │         │                │
│  │  /login        │   │  ┌─────▼──────┐  │                │
│  └───────┬───────┘   │  │ AI Service │  │                │
│          │            │  │ (Python)   │  │                │
│    ┌─────▼─────┐      │  └───────────┘  │                │
│    │  Supabase │◄─────┤                 │                │
│    │  (DB+Auth)│      └─────────────────┘                │
│    └─────┬─────┘                                         │
│    ┌─────▼─────┐                                         │
│    │  R2 Store │                                         │
│    │  (Assets) │                                         │
│    └───────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

**三層架構**：
| 層級 | 技術 | 角色 |
|------|------|------|
| Marketing 官網 | Next.js 16 + Tailwind CSS 4 | 產品介紹、定價、訂閱、教學試用 |
| Desktop 應用 | Electron 38 + React 19 + Vite | 本地 AI 製譜、跟彈練習、離線跑 |
| AI 服務 | Python FastAPI + 7 個 ML 模型 | 音源分離、和弦辨識、歌詞轉寫、GP5 生成 |

---

## 2. Marketing 官網

官網路徑：`apps/web` ｜ 技術棧：Next.js 16.2.3 (App Router) + React 19.2.4 + Tailwind CSS 4 + Supabase SSR

### 2.1 頁面路由

| 路由 | 說明 | 認證 |
|------|------|:--:|
| `/` | 官網首頁（Hero + AI 編配 / 跟練 / 教學區 + CTA） | - |
| `/features` | 功能介紹頁（四大核心功能模組卡片） | - |
| `/pricing` | 定價頁（免費體驗 / Pro 月繳 ¥29 / 季繳 ¥69 / 年繳 ¥199） | - |
| `/download` | 桌面版下載頁（macOS .dmg + Windows .exe） | - |
| `/support` | 幫助支援頁（9 題 FAQ 手風琴展開） | - |
| `/learn` | 教學曲目列表（從 Supabase + R2 公開讀取） | - |
| `/learn/[slug]` | 教學曲目詳情頁 | - |
| `/learn/[slug]/[module]` | 模組課程頁（warmup/basic/advanced/solo），進階需 Pro | Cookie |
| `/play` | 網頁試用 AI 製譜（每月 3 次，帶下載 CTA banner） | Cookie |
| `/editor/[jobId]` | 吉他譜編輯器 / 跟練 | Cookie |
| `/dashboard` | 曲譜儀表板（搜尋、排序、分頁、會員狀態） | Cookie |
| `/login` | 登入頁 | Cookie |
| `/update-password` | 密碼更新頁 | Cookie |
| `/admin/teaching` | 教學管理列表頁 | Admin |
| `/admin/teaching/[songId]` | 編輯 / 新增教學歌曲 | Admin |

### 2.2 API 路由

#### 生成（Jobs）

| 方法 | 端點 | 說明 |
|------|------|------|
| `POST` | `/api/upload-url` | 取得 R2 presigned PUT URL |
| `POST` | `/api/jobs` | 建立 AI 任務（含 rate limit + quota gate） |
| `GET` | `/api/jobs/[jobId]` | 輪詢 job 狀態 |
| `GET` | `/api/jobs/[jobId]/result` | 取得生成結果 JSON |
| `GET` | `/api/jobs/[jobId]/gp5?level=1-4` | 下載 GP5（R2 或 AI 後端） |
| `GET` | `/api/jobs/[jobId]/audio?type=original\|no_vocals` | 取得音訊 |

#### 用戶與付費

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/dashboard/jobs` | 分頁查詢用戶曲譜（page/limit/search/sort） |
| `GET` | `/api/me/subscription` | 查詢訂閱狀態與配額 |
| `POST` | `/api/stripe/checkout` | 建立 Stripe checkout session |
| `POST` | `/api/stripe/webhook` | Stripe webhook |

#### 教學內容（公開）

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/teaching/songs` | 教學曲目列表 |
| `GET` | `/api/teaching/songs/[slug]/[module]` | 讀取模組 JSON |
| `GET` | `/api/teaching/gp5/[slug]/[filename]` | 下載教學 GP5 |
| `GET` | `/api/teaching/media/[slug]/[filename]` | 取得教學媒體 |

#### Admin

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET/POST` | `/api/admin/setup` | 一鍵初始化 admin |
| `GET/POST` | `/api/admin/teaching/songs` | CRUD 教學歌曲 |
| `POST` | `/api/admin/teaching/generate/[songId]` | 觸發生成教學模組 |
| `POST` | `/api/desktop/admin/teaching/songs/[songId]/save` | Desktop 端保存教學 |
| `POST` | `/api/desktop/admin/teaching/generate/[songId]` | Desktop 端生成教學 |

### 2.3 共用元件

| 元件 | 說明 |
|------|------|
| `upload-client.tsx` | 音頻上傳 + job 輪詢（Web 專用 R2 流程） |
| `editor-client.tsx` | Editor 容器（含 PracticeMode） |
| `PracticeMode.tsx` | AlphaTab 播放核心（音源切換、和弦顯示、難度選擇） |
| `ChordDiagram.tsx` | 和弦指法圖 |
| `ChordTimeline.tsx` | 和弦時間軸（scroll snap） |
| `PlaybackControls.tsx` | 播放控制 + 速度/移調/Loop |
| `SyncedLyrics.tsx` | 同步歌詞 |
| `TimelineViewer.tsx` | Canvas 時間軸視覺化 |
| `navbar.tsx` | 官網導覽列 |
| `footer.tsx` | 官網頁尾 |
| `HealthProvider.tsx` | AI 健康檢查 |
| `ToastProvider.tsx` | Toast 通知 |

---

## 3. Desktop 桌面應用

路徑：`apps/desktop`（主進程）+ `apps/desktop-ui`（UI 進程）

技術棧：Electron 38 + React 19 + React Router 7 + Vite 6 + Tailwind CSS 4

### 3.1 頁面路由

| 路由 | 元件 | 說明 |
|------|------|------|
| `/` | `HomePage` | 產品首頁（登入前有 CTA banner） |
| `/play` | `PlayPage` | AI 製譜入口（本機音頻 / URL） |
| `/editor/:jobId` | `EditorPage` | 吉他譜編輯器（AlphaTab 渲染 + GP5 下載） |
| `/practice/:jobId` | `PracticePage` | 獨立練習頁（全螢幕深色模式） |
| `/dashboard` | `DashboardPage` | 曲譜管理（搜尋、排序、分頁） |
| `/learn` | `LearnPage` | 教學曲目列表（和 Web 同一數據源） |
| `/learn/:slug/:module` | `LessonPage` | 教學模組（Pro 鎖 advanced/solo） |
| `/admin/teaching` | `AdminTeachingListPage` | 教學管理列表 |
| `/admin/teaching/:songId` | `AdminTeachingEditPage` | 編輯 / 新增教學 |
| `/login` | `LoginPage` | 登入頁 |
| `/update-password` | `UpdatePasswordPage` | 密碼更新 |

### 3.2 IPC Handler

透過 `window.desktop` 暴露 14 個 IPC 方法：

**本地檔案操作**：
- `pick-audio-file` — 系統檔案對話框選音頻
- `pick-teaching-file` — 選教學素材（gp5 / audio / video）
- `teaching-get-paths` — 取得教學目錄路徑
- `teaching-write-manifest` — 寫入 manifest.json
- `teaching-save-asset` — 保存教學素材
- `teaching-read-text` / `teaching-read-public-bytes` — 讀取教學檔案
- `teaching-generate-lessons` — 本機執行 `generate_lessons.py`
- `teaching-delete-song` — 刪除教學歌曲

**雲端 API 代理**：
- `cloud-get-text` — GET Web API（回文字）
- `cloud-get-bytes` — GET Web API（回二進位）
- `cloud-post-json` — POST JSON 到 Web API
- `cloud-teaching-save` — 上傳教學素材 multipart
- `cloud-teaching-generate` — 觸發雲端生成

### 3.3 Hooks

| Hook | 說明 |
|------|------|
| `useSubscription` | 訂閱狀態管理（isPro / usedQuota / totalQuota），監聽 onAuthStateChange |

### 3.4 練習元件

| 元件 | 說明 |
|------|------|
| `PracticeMode.tsx` | AlphaTab 播放控制核心（150ms 節流 + 事件洩漏修復） |
| `PlaybackControls.tsx` | 播放/暫停/速度/移調/Loop/音源切換 |
| `ChordDiagram.tsx` / `LargeChordDiagram.tsx` | 和弦指法圖 |
| `ChordTimeline.tsx` | 和弦時間軸（React.memo 優化） |
| `SyncedLyrics.tsx` | 同步歌詞（React.memo + deep compare） |

### 3.5 離線 / 未登入模式

Desktop 支援未登入瀏覽：
- **首頁**：產品介紹 + 登入 CTA banner
- **教學**：瀏覽 + 練習（open 模組），Pro 模組鎖定
- **彈唱**：入口可見，AI 製譜需登入
- **跟練**：入口可見，練習模式需登入
- **Dashboard / Admin**：需登入

---

## 4. AI 服務

路徑：`services/ai` ｜ 技術棧：Python 3.9+ / FastAPI / Uvicorn

### 4.1 API 端點

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/health` | 健康檢查 |
| `POST` | `/jobs` | 建立任務（local file / R2 / URL） |
| `GET` | `/jobs/{job_id}` | 查詢任務狀態 |
| `GET` | `/jobs/{job_id}/result` | 取得 JSON 結果 |
| `GET` | `/jobs/{job_id}/result.gp5?level=1-4` | 下載 GP5 |
| `GET` | `/jobs/{job_id}/audio?type=original\|no_vocals` | 取得音訊 |

### 4.2 處理 Pipeline

```
音頻輸入（本地 / R2 / URL）
  │
  ├── 1. yt-dlp 下載（URL 模式）
  │
  ├── 2. Demucs 音源分離（vocals / drums / bass / other / no_vocals）
  │
  ├── 3. Faster-Whisper 語音轉寫 → 歌詞
  │     └── DeepSeek API 歌詞驗證（可選）
  │
  ├── 4. Basic Pitch 旋律提取 → MIDI 音符
  │
  ├── 5. Madmom / Librosa 和弦檢測
  │     ├── DeepChroma + CRF（高精度）
  │     └── Chroma 模板匹配（fallback）
  │
  ├── 6. 節奏動機檢測 + 段落識別
  │     └── Intro / Verse / Chorus / Bridge / Outro
  │
  ├── 7. 風格融合 + 聲部優化
  │
  ├── 8. PyGuitarPro → GP5 二進位
  │
  └── 9. 儲存結果
        ├── Desktop：本地 storage/results/{jobId}/
        └── Web：R2 results/{jobId}/
```

### 4.3 AI 模型清單

| 模型 | 用途 | 費用 |
|------|------|:--:|
| Demucs (htdemucs_6s) | 6 軌音源分離 | 免費 |
| Faster-Whisper (small) | 語音轉歌詞 | 免費 |
| Basic Pitch (Spotify) | 旋律音符檢測 | 免費 |
| Madmom (DeepChroma+CRF) | 和弦識別 | 免費 |
| Librosa | 音訊分析（chroma/tempo/beat） | 免費 |
| PyGuitarPro | GP5 格式寫入 | 免費 |
| DeepSeek API | 歌詞驗證（可選） | ~¥0.01/首 |

### 4.4 Python 模組

| 模組 | 功能 |
|------|------|
| `main.py` | 主入口：FastAPI app、job pipeline、Supabase/R2 整合 |
| `source_separation.py` | Demucs 音源分離 |
| `vocal_analysis.py` | Faster-Whisper + Basic Pitch |
| `melody_detector.py` | 旋律提取 + 簡譜生成 |
| `melody_tab.py` | 主旋律 TAB |
| `intro_transcriber.py` | 前奏轉寫 |
| `chord_detector.py` | 和弦檢測（madmom/librosa 自動切換） |
| `chord_detector_madmom.py` | Madmom 和弦識別 |
| `chord_detector_librosa.py` | Librosa 和弦識別（fallback） |
| `chord_shapes.py` | 和弦指法庫 |
| `chord_simplifier.py` | 和弦簡化 |
| `voice_leading.py` | 聲部進行優化 |
| `section_detector.py` | 段落檢測 |
| `pattern_engine.py` | 節奏模式引擎 |
| `motif_detector.py` | 節奏動機檢測 |
| `style_fuser.py` | 風格融合 |
| `technique_detector.py` | 技巧檢測 |
| `lyric_verifier.py` | DeepSeek 歌詞驗證 |
| `audio_preprocess.py` | HPSS 預處理 |
| `gp_generator.py` | GP5 生成器 |
| `formatters.py` | 練習資料格式化 |
| `waveform.py` | 波形計算（前端視覺化） |
| `generate_lessons.py` | 教學模組生成（warmup/basic/advanced/solo） |

---

## 5. 資料庫與存儲

### 5.1 Supabase 資料表（4 張）

**ai_jobs** — AI 生成任務
| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | text PK | Job ID |
| `user_id` | uuid | RLS key，FK → auth.users |
| `status` | text | queued / processing / succeeded / failed |
| `progress` | number | 0-100 |
| `title` | text | 曲目標題 |
| `audio_path` | text | R2 key 或 URL |
| `result` | json | 生成結果 |
| `preview` | json | 前端顯示 step |
| `created_at` | timestamptz | Dashboard 排序依賴 |

RLS：authenticated 只能 CRUD 自己的 `user_id`；service_role 全權。

**subscriptions** — 訂閱狀態
| 欄位 | 類型 | 說明 |
|------|------|------|
| `user_id` | uuid UNIQUE | FK → auth.users |
| `stripe_customer_id` | text | Stripe 客戶 ID |
| `stripe_subscription_id` | text UNIQUE | Stripe 訂閱 ID |
| `plan_type` | text | free / monthly / quarterly / yearly |
| `status` | text | inactive / active / canceled |
| `current_period_end` | timestamptz | 有效期截止 |

**teaching_songs** — 教學曲目
| 欄位 | 類型 | 說明 |
|------|------|------|
| `slug` | text | URL / R2 key 前綴 |
| `title` | text | 曲目標題 |
| `artist` | text | 藝術家 |
| `status` | text | draft / published |
| `manifest` | json | 完整教學配置 |

RLS：admin 全權；任何人可讀 `status = published`。

**admin_users** — 管理員表
| 欄位 | 類型 | 說明 |
|------|------|------|
| `user_id` | uuid PK | FK → auth.users |

搭配 `is_admin()` RPC function 判斷管理員權限。

### 5.2 Cloudflare R2 存儲

| 內容 | Key 格式 |
|------|----------|
| 用戶上傳 | `uploads/{userId}/{file}` |
| AI 結果 GP5 | `results/{jobId}/result.gp5` |
| AI 結果 JSON | `results/{jobId}/output.json` |
| 去人聲 | `stems/{jobId}/no_vocals.mp3` |
| 教學 source | `teaching/{slug}/source/base.gp5` |
| 教學模組 | `teaching/{slug}/modules/{module}.json` |
| 教學 GP5 | `teaching/{slug}/gp5/{module}.gp5` |
| 教學媒體 | `teaching/{slug}/media/demo_video.mp4` 等 |

---

## 6. 環境變數總表

### Web (Next.js)

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook 寫入權限 |
| `AI_BASE_URL` | AI 服務位址（預設 `http://127.0.0.1:8001`） |
| `AI_SERVICE_TOKEN` | AI 內部認證 token |
| `CLOUDFLARE_ACCOUNT_ID` | R2 帳戶 |
| `CLOUDFLARE_ACCESS_KEY_ID` | R2 token |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | R2 secret |
| `CLOUDFLARE_BUCKET_NAME` | R2 bucket（預設 `biubiutab-uploads`） |
| `CLOUDFLARE_PUBLIC_DOMAIN` | R2 公開域名 |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 簽名 |
| `STRIPE_PRICE_SUB_{MONTHLY\|QUARTERLY\|YEARLY}` | 訂閱價格 ID |
| `ADMIN_EMAILS` | 管理員 email 白名單（逗號分隔） |

### Desktop

| 變數 | 用途 |
|------|------|
| `WEB_BASE_URL` | Web API 基礎 URL |
| `DESKTOP_UI_PORT` | Vite dev 埠號（預設 5174） |
| `AI_PYTHON` | 強制 Python 路徑 |
| `AI_AUTO_SETUP` | 自動建立 venv（1=啟用） |
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_AI_BASE_URL` | AI 位址（預設 `http://127.0.0.1:8001`） |
| `VITE_ADMIN_EMAILS` | Admin email 白名單 |

### AI 服務

| 變數 | 用途 | 預設值 |
|------|------|--------|
| `AI_SERVICE_TOKEN` | 內部認證 | — |
| `AI_JOB_TIMEOUT_SEC` | Job 超時 | 1200 |
| `SUPABASE_URL` / `SUPABASE_KEY` | Supabase 連接 | — |
| `CLOUDFLARE_*` | R2 憑證 | — |
| `DEEPSEEK_API_KEY` | 歌詞驗證（可選） | — |
| `AI_GENERATE_ALL_LEVELS` | 生成 4 級 GP5 | — |
| `ENABLE_STORAGE_CLEANUP` | 儲存清理 | 1 |

---

## 7. 部署

### 開發環境

```bash
# Web 官網（終端機 1）
cd apps/web && npm run dev          # http://localhost:3000

# Desktop（終端機 2）
cd apps/desktop && npm run dev       # 啟動 Vite + Electron + AI server
```

### 生產部署

| 目標 | 方式 |
|------|------|
| **Mac 安裝檔** | `cd apps/desktop && npm run dist:mac` → 輸出 `.dmg` |
| **Windows 安裝檔** | `cd apps/desktop && npm run dist:win` → 輸出 `.exe` |
| **Web 官網** | 部署到 Vercel（`apps/web`） |
| **AI 服務（可選）** | Docker → `services/ai/Dockerfile` |
| **靜態官網** | `cd apps/web && npm run build && npm start` |

---

## 8. 成本結構

| 類型 | 桌面版 | Web 版 |
|------|:--:|:--:|
| AI 模型推論 | 用戶本機（¥0/首） | 需伺服器 GPU |
| 歌詞驗證 API | DeepSeek ~¥0.01/首 | 同左 |
| 儲存 | 本機（¥0） | R2 免費層 10GB |
| 資料庫 | Supabase 免費層 | 同左 |
| 邊際成本 / 用戶 | **~¥0.01** | 需伺服器維護 |

桌面版的邊際成本接近零，是主要推薦使用方式。

---

## 9. 後續可做事項

### 🔴 高優先級

| 項目 | 說明 |
|------|------|
| **實際打包測試** | 用 electron-builder 打出 `.dmg` / `.exe`，在目標系統測試安裝 → 啟動 → 功能完整 |
| **Stripe 閉環測試** | 完整跑一次：Web 定價頁付款 → webhook → DB → Desktop 自動同步 Pro |
| **GPX 教學相容** | 目前教學生成依賴 `.gp5` 格式，需支援 `.gpx` 確保兼容各平台 |
| **錯誤日誌系統** | 桌面崩潰日誌收集（Electron crashReporter + Sentry） |

### 🟡 中優先級

| 項目 | 說明 |
|------|------|
| **Desktop 自動更新** | electron-updater，當 GitHub Release 有新版本時推送更新 |
| **官網部署公開** | 把 `apps/web` 推到 Vercel，讓官網有公開域名 |
| **教學內容線上編輯** | Admin 可在 Web 端直接編輯教學模組內容（目前依賴 Desktop） |
| **多語言支援** | i18n（繁體中文 / 簡體中文 / 英文 / 日文） |
| **音頻錄製** | Desktop 內建錄音功能，可錄製琴聲直接生成譜 |

### 🟢 低優先級

| 項目 | 說明 |
|------|------|
| **Linux 支援** | 打包 .AppImage / .deb，確保 AI 依賴在 Linux 兼容 |
| **社群曲譜庫** | 用戶可公開發布自己的譜例，類似 Ultimate Guitar 模式 |
| **行動端 App** | React Native 或 Flutter 製作手機版（僅瀏覽 + 跟練，不含 AI 生成） |
| **協作功能** | 多人實時編輯同一份吉他譜 |
| **AI 擴充** | 支援更多風格（Fingerstyle、古典）、自動編曲建議 |
| **效能優化** | GPU 加速（CUDA/CoreML）、模型量化、冷啟動加速 |
| **測試覆蓋** | 單元測試 + E2E 測試（Playwright for Electron） |
| **CI/CD** | GitHub Actions 自動建構 + 發布 |

---

> **維護注意**：`WEB.md` 是 Web 版的權威技術文件。本文檔為整體產品視角的總覽文檔。
> 任何功能變更應同步更新對應文檔。
