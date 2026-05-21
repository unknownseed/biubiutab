# Web → Desktop 移植參考要點（以 apps/web 為基準）

本文檔把 Web 端的關鍵「契約」抽出來，方便 Desktop 端後續做功能對齊時有明確的對照物：哪些能力應該直接復用 Web API、哪些需要 Desktop 專用 API、以及 Cloudflare 分發下的注意事項。

## 1. 建議的整體策略

- Desktop 優先把 Web 當成「權限與資源的統一入口」：
  - 訂閱/配額 gate（Free/Pro、quota）在 Web：[/api/jobs/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/route.ts#L37-L51)
  - R2 CORS 的處理在 Web（gp5 route 由 server side fetch 回 bytes）：[/gp5 route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/gp5/route.ts#L35-L48)
  - 教學 modules 的發布狀態與讀取（published + disk JSON）在 Web：[/api/teaching/songs/[slug]/[module]/route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/teaching/songs/%5Bslug%5D/%5Bmodule%5D/route.ts#L15-L42)
- Desktop 應避免直接呼叫 Python AI service（`services/ai`）：
  - 會繞過 quota/rate limit
  - 容易出現 CORS、network topology（本地 vs 雲端）差異

## 2. Desktop 需要對齊的 Web API 清單（最小集合）

### 2.1 生成（Jobs）

- 建立 job：`POST /api/jobs`
  - body：`{ storedFilename?: string; url?: string; title?: string }`
  - 重要：storedFilename 必須是 `uploads/<userId>/...` 且通過字元白名單
- 輪詢 job：`GET /api/jobs/<jobId>`
- 結果：`GET /api/jobs/<jobId>/result`
- GP5：`GET /api/jobs/<jobId>/gp5?level=1|2|3|4`
- 音訊：`GET /api/jobs/<jobId>/audio?type=original|no_vocals`

### 2.2 上傳（R2）

- 取得 presigned URL：`POST /api/upload-url`
  - body：`{ filename, contentType?, size? }`
  - 回傳：`{ url, key, publicUrl }`
  - Desktop 建議同 Web 一樣直傳 R2，再把 `key` 回填給 `POST /api/jobs` 作 storedFilename

### 2.3 教學（Teaching）

- 列表：`GET /api/teaching/songs`（只回 published）
- 讀 module：`GET /api/teaching/songs/<slug>/<module>`（回 JSON）
- 讀譜例（GP5 bytes）：`GET /api/teaching/gp5/<slug>/<filename>`（建議 Desktop 直接抓這個，避免 R2 CORS）
- 讀演示媒體：`GET /api/teaching/media/<slug>/<filename>`（通常會 redirect 到 R2 public domain）

### 2.4 付費（Stripe）

- Checkout：`POST /api/stripe/checkout`（需要登入）
- Webhook：僅 Stripe 服務端調用（Desktop 不需要）
- 訂閱資訊（Pro 狀態與本月配額）：`GET /api/me/subscription`
  - Web：cookie session
  - Desktop：`Authorization: Bearer <supabase_access_token>`
  - 回傳：`{ isPro, planType, status, currentPeriodEnd, usedQuota, totalQuota }`：[route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/me/subscription/route.ts)

## 3. 鑑權差異：Cookie Session vs Bearer Token

### Web 現況

- 大多數 Web API 依賴 Supabase 的 cookie session（middleware + createClient）：
  - [/middleware.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/middleware.ts#L39-L69)
- Stripe webhook 使用 service role key（不走使用者身份）。

### Desktop 的常見問題

- Desktop 用 `fetch()` 直接打 Web domain 時：
  - 很難自然攜帶 Supabase 的 cookie session（尤其非瀏覽器同源情境）
  - CORS/redirect 也會放大差異

### 建議

- 若 Desktop 以 Supabase access token 驅動（Bearer）：
  - 建議提供 Desktop 專用 API route（例如 `/api/desktop/...`），在 route 中從 `Authorization: Bearer <token>` 驗證 user 並執行後續邏輯。
  - 這類 API 可與 Web 版 cookie session API 並存，不互相影響。

## 4. Cloudflare 分發下的注意事項

### 4.1 R2 public domain 與 CORS

- 音訊 route 在 R2 模式下回 redirect 到 `CLOUDFLARE_PUBLIC_DOMAIN/...`：[/audio route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/audio/route.ts#L29-L46)
- GP5 route 在 R2 模式下由 Web server fetch 回 bytes（避免瀏覽器 CORS）：[/gp5 route.ts](file:///Users/unknownseed/Developer/biubiutab/apps/web/src/app/api/jobs/%5BjobId%5D/gp5/route.ts#L35-L48)
- Desktop 若直接 fetch R2 的 `.r2.dev` 域名，仍可能遇到 CORS；復用 Web 的 gp5 route 能省掉這部分。

### 4.2 教學內容的「發布」方式

- Web 的 teaching modules 是 repo 內 `apps/web/songs/` 的檔案，通常會透過部署/CDN 分發給所有用戶。
- 因此 Desktop 的 Learn 模塊應視「Web origin」為內容源：
  - 列表/發布狀態（DB）：`teaching_songs.status = published`
  - 實際內容（檔案）：`songs/<slug>/<module>.json`

若後續要把教學內容完全動態化（不依賴部署），需要把教學 modules 上傳到 R2 或其他 object store，再由 API 返回 object URL 或 bytes（屬於產品/架構升級，不是純移植）。

## 5. Desktop 端 UI/行為對齊清單（建議）

- Play/生成：
  - 與 Web 一致的 step 顯示與輪詢策略（job preview.step）
  - 超額時顯示 Web 返回的 message（403）
- Editor/Practice：
  - 優先沿用 Web 的 gp5/audio API 契約，播放器只關心「gp5 bytes + audio url」
- Learn/教學：
  - Warmup/Basic：Free 可練，但 demo video（若存在）對 Free 應隱藏
  - Advanced/Solo：Free 顯示鎖定與升級 CTA
- Pricing/訂閱：
  - Desktop 若提供內嵌購買，最簡路徑是呼叫 Web checkout route 取得 `session.url` 後用系統瀏覽器打開
