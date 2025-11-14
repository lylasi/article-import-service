# 部署說明

## Cloudflare Workers
1. 安裝 wrangler：`npm install -g wrangler`
2. 登入：`wrangler login`
3. 設定 `wrangler.toml` 中的 KV、Cron 與變數。
4. 透過 `wrangler deploy` 部署。
5. 若需自訂網域，於 Workers Routes 設定 `https://api.example.com/article/*`。

### 環境變數
- `ALLOW_HOSTS`：允許抓取的網域，逗號分隔。
- `MAX_BYTES`：允許下載的最大位元數。
- `SOURCES_JSON`：Feed 來源設定 JSON。
- `FEED_CACHE_TTL`：快取秒數。

## Docker / Node
1. `docker build -t article-import-service .`
2. `docker run -p 8787:8787 -e ALLOW_HOSTS="..." article-import-service`
3. 可在 Kubernetes/Fly.io 等環境水平擴充，前面加上 CDN。

### 重要檔案
- `Dockerfile`：Node 20 Alpine，啟動 `src/index-node.js`。
- `scripts/bundle-node.mjs`：如需 bundle，可使用 `esbuild`（目前範例採原生 ESM，未啟用）。

## Cron 任務
`wrangler.toml` 中以 `[[triggers]]` 定義，呼叫 `refreshFeeds()` 以預抓 RSS 內容。Node 版本可搭配外部 scheduler（如 GitHub Actions, Cloud Scheduler）。
