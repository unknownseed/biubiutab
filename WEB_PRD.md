# Web 產品需求文檔（Biubiutab Web）

本文檔描述 Web 版（`apps/web`）產品需求，與實作對齊：AI 制譜生成、跟彈練習、教學內容、訂閱/充值（Stripe）、以及 Cloudflare 分發模型。後續 Desktop 端移植時可把此文檔視為「行為基準」。

## 1. 產品願景

- 讓使用者把「一段音訊」快速轉成可播放、可跟彈、可練習的吉他譜（GP5/譜面播放）。
- 同時提供「教學內容庫」：把歌曲拆成 Warmup / Basic / Advanced / Solo 的分段練習，並能在 Pro 方案中解鎖更完整的高階模組與 Demo video。

## 2. 角色與使用情境

### 2.1 一般使用者

- 初學者（Free）：低成本體驗 AI 制譜與基礎教學（Warmup/Basic），每月有限額度。
- 進階使用者（Pro）：需要更多生成配額、解鎖 Advanced/Solo 與 Demo video、以及更完整的雲端留存與下載能力。

### 2.2 管理員（內容供給端）

- 負責把指定歌曲的素材（base.gp5、manifest、影片等）導入並生成教學 modules，發布後所有用戶可在 Learn 模塊中看到。

## 3. 訂閱與分級策略（Free vs Pro）

### 3.1 方案定義（以 Web 實作為準）

- Free
  - 每月 AI 制譜 3 次（在 UI 文案中稱「限時 90 秒」，屬於方案描述）
  - 可訪問教學：Warmup/Basic
  - 可使用播放器跟彈練習
- Pro
  - 每月 AI 制譜 100 次
  - 解鎖教學：Advanced/Solo
  - Demo video 可見（Warmup/Basic 也因此變得更完整）
  - 支持下載原版 .gp5（以 UI 文案為準）

對應 UI：[/pricing/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/pricing/page.tsx#L59-L73)

### 3.2 配額（Quota）規則

- 以「本月（當月第一天至今）」`ai_jobs` 數量作為 usedQuota。
- 超額時，AI 生成入口必須被硬性阻止，返回明確提示（403）。
  - 實作：[/api/jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts#L37-L51)

## 4. 核心功能模組

## 4.1 註冊/登入與會話

### 功能

- 使用者可註冊/登入並保持會話。
- 未登入使用者不可使用「消耗算力」與「敏感資源」能力（生成、上傳、Dashboard、Admin 等）。

### 驗收標準

- 未登入訪問受保護頁面會跳轉到 `/login`。
- 未登入打受保護 API 會得到 401 JSON。
- 已登入訪問 `/login` 會被重定向到 `/`。
  - 實作：[/middleware.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/middleware.ts#L70-L105)

## 4.2 AI 制譜（Play / Jobs）

### 入口與流程

- 入口頁：`/play`
- 使用者提供輸入：
  - 上傳本地音訊（mp3/wav，大小限制 50MB）
  - 或提供 URL（http/https）
- 系統建立生成任務（job），前端輪詢進度，成功後進入 `/editor/<jobId>`。

### 關鍵需求

- 上傳採用 presigned URL 直傳 Cloudflare R2，提升上傳吞吐、避免 web server 成為瓶頸。
  - `POST /api/upload-url`：回傳 `{ url, key, publicUrl }`，key 以 `uploads/<userId>/...` 命名。
- 建立 job 前必須經過：
  - 登入校驗
  - rate limit（user + ip）
  - quota gate（Free 3/月，Pro 100/月）
  - 安全檢查：storedFilename 必須只含安全字元且前綴為當前 user 的 uploads 路徑
  - 實作：[/api/jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts#L20-L74)

### 驗收標準

- Free 用戶本月第 4 次觸發生成時必須看到清晰的「配額已用盡」提示，且無 job 被建立。
- 上傳超過 50MB 必須被拒絕（413）。
- 非 mp3/wav 必須被拒絕（400）。
  - 實作：[/api/upload-url/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/upload-url/route.ts#L23-L58)

## 4.3 Editor 與跟彈練習（Practice）

### 功能

- 在 `/editor/<jobId>` 中展示制譜結果，並提供播放/跟彈能力。
- Practice 模式提供：
  - 播放控制（播放/暫停/速度）
  - 可選音源（原聲/去人聲）

### 體驗要求

- 在 job 未完成前需持續展示進度狀態，避免空白或無反饋。
- 音源切換時不得中斷整個譜面，盡量只替換音源。

### 驗收標準

- 在 R2 分發模型下：
  - `GET /api/jobs/<id>/audio?type=original|no_vocals` 應回 redirect 到可公開訪問的音訊 URL（或能在瀏覽器播放）。
  - `GET /api/jobs/<id>/gp5` 應返回可下載 bytes（避免瀏覽器 CORS 阻斷）。
  - 實作：[/audio route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/audio/route.ts#L29-L47), [/gp5 route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/gp5/route.ts#L23-L48)

## 4.4 Dashboard（我的曲譜）

### 功能

- 使用者可查看自己歷史生成的 jobs 列表。
- 支持刪除條目（不一定刪除 R2 物理檔案，但至少從 DB 清單移除）。

### 驗收標準

- 未登入不可訪問 Dashboard。
- 列表只顯示自己 user_id 的資料。

## 4.5 教學內容庫（Learn）

### 功能

- 使用者可查看教學歌曲清單，並進入某首歌的模組：
  - Warmup（預習）
  - Basic（基礎跟彈）
  - Advanced（進階）
  - Solo（Solo/即興）
- 每個模組由多個練習區塊組成（PracticeBlock），每個區塊可：
  - 載入 GP5
  - 設置 tempo
  - 設置 loop 範圍（按小節）
  - 顯示 tips
  - 可選播放 Demo video（若 Pro）

### 訂閱 gating 規則

- Free：
  - 可訪問 Warmup/Basic，但 Demo video 不可見
  - 不可訪問 Advanced/Solo（直接顯示鎖定頁，提供去 Pricing 的 CTA）
- Pro：
  - 可訪問所有模組
  - Demo video 可見

對應實作：
- Warmup：[/warmup/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/learn/%5Bslug%5D/warmup/page.tsx#L20-L56)
- Basic：[/basic/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/learn/%5Bslug%5D/basic/page.tsx#L20-L37)
- Advanced gate：[/advanced/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/learn/%5Bslug%5D/advanced/page.tsx#L25-L47)
- Solo gate：[/solo/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/learn/%5Bslug%5D/solo/page.tsx#L27-L49)

### 驗收標準

- published 的教學歌曲應出現在列表中；draft 不應出現。
  - API：[/api/teaching/songs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/teaching/songs/route.ts#L8-L13)
- 任何 `GET /api/teaching/songs/<slug>/<module>` 若歌曲非 published 或 module 檔案不存在，必須回 404，且前端應以 notFound/友好提示處理。

## 4.6 Admin 教學內容生成與發布

### 功能

- Admin 能建立 teaching song 條目（slug/title/artist/manifest）。
- Admin 能觸發「生成教學內容」流程：
  - 從 manifest 生成 `warmup/basic/advanced/solo` JSON
  - 生成後把 status 切換為 published，讓所有用戶可見

### 生成流程（產品層行為）

- Draft：在 DB 有條目，但前台不可見
- Published：前台可見，且 module API 能讀到實際檔案

### 驗收標準

- 非 admin 訪問 admin API 返回 403。
- Generate 成功後，對應歌曲立即出現在前台列表，且能讀取 modules。
  - Admin API：[/api/admin/teaching/songs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/admin/teaching/songs/route.ts#L5-L47)
  - Generate API：[/api/admin/teaching/generate/[songId]/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/admin/teaching/generate/%5BsongId%5D/route.ts#L11-L88)

## 4.7 付費（Stripe Checkout + Webhook）

### 功能

- 價格頁 `/pricing` 提供兩種付費方式：
  - 自動續訂（subscription，信用卡）
  - 單次充值（payment，含支付寶）
- 支付完成後，系統必須在 Supabase `subscriptions` 中更新用戶狀態，讓 gate 即刻生效。

### 驗收標準

- 未登入點擊購買必須被引導到 `/login?next=/pricing`。
  - Pricing 頁處理：[/pricing/page.tsx](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/pricing/page.tsx#L41-L47)
- Webhook 收到事件後能正確 upsert subscriptions（包含 active/canceled 與有效期）。
  - 實作：[/stripe/webhook/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/stripe/webhook/route.ts#L33-L167)
- 單次充值的有效期延長規則：在既有有效期基礎上追加（若尚未到期）。
  - 實作：[/stripe/webhook/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/stripe/webhook/route.ts#L91-L107)

## 5. 非功能需求（NFR）

### 5.1 安全

- 所有消耗算力與涉及用戶資料的 API 必須登入校驗（middleware + route 自身二次校驗）。
- webhook 必須使用 service role，避免受 RLS 限制；且必須驗簽。
- storedFilename 必須做白名單字元與路徑前綴校驗，避免任意路徑/越權讀寫。

### 5.2 性能與可用性

- 上傳走 R2 presigned URL。
- Vercel/Serverless 可能存在 timeout，AI service fetch 有 timeout + 重試策略（Vercel 下縮短，並在 cold start 場景回 503 提示）。
  - 實作：[/ai.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/lib/ai.ts#L17-L39)

### 5.3 可觀測性

- 每個請求注入 `x-request-id`，並向下游傳遞給 AI service。
  - middleware：[/middleware.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/middleware.ts#L5-L9)
  - jobs route 向 AI service 透傳：[/api/jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts#L78-L83)

## 6. 產品風險與已知缺口（基於代碼現狀）

- Admin 權限目前用 email 白名單判斷，且部分管理 API 仍限制只能看/管自己的 `user_id`；若產品目標是「平台內容供所有人」，建議改為 DB 層 admin（RPC + RLS），或至少後端 API 以 admin 身份讀全量教學歌曲。
- 教學內容以 `apps/web/songs/` 檔案形式隨部署分發，適合 Cloudflare/CDN 靜態發佈，但需要對生成/更新的發布節奏有一致策略（例如：生成後如何進入部署流程）。

