# 部署說明

## Cloudflare Workers（現行線上）

```bash
npm install
npx wrangler whoami        # 確認已登入
npx wrangler deploy
```

- `wrangler.toml` 已填好 `name`、`main`、`compatibility_date`、KV namespace 與變數。
- **注意**：這個 Worker 先前有幾次是透過 Dashboard／Script API 更新的。用 `wrangler deploy` 會以本地程式碼與 `[vars]` **覆蓋**線上設定，wrangler 會先警告並要求確認（非互動環境會自動選 yes）。
- 部署後建議實測（等 20～30 秒讓舊 isolate 排空）：

  ```bash
  curl -s "https://article-import-service.lylasi.workers.dev/feeds" | head -c 200
  curl -s -G --data-urlencode "url=https://www.bbc.co.uk/news/articles/c8wy9veedgygo" \
       --data-urlencode "format=json" --data-urlencode "includeMarkdown=true" \
       "https://article-import-service.lylasi.workers.dev/extract" | head -c 200
  ```

- 排查線上用 `npx wrangler tail`。注意：被 `try/catch` 接住後轉成 500 的例外**不會**出現在 tail 的 `exceptions`（outcome 仍是 ok），要看我們自己印的 `[article-service] extract failed ...` 日誌。

### 環境變數

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `ALLOW_HOSTS` | `src/lib/config.js` 的 `DEFAULT_ALLOW_HOSTS` | 允許抓取的網域，逗號分隔，支援 `*.example.com` |
| `MAX_BYTES` | `8000000` | 單次下載上限；CNN 文章頁約 6.17MB |
| `SOURCES_JSON` | `{}`（用內建 `DEFAULT_SOURCES`） | 非空時**完全取代**內建來源清單 |
| `FEED_CACHE_TTL` | `300` | feed 快取秒數（KV `FEEDS_CACHE`） |

### KV

```
binding = "FEEDS_CACHE"
id      = "2da90f96c5624b1aa980f505ea313800"
```

## Docker / Node

```bash
docker compose up -d --build          # 宿主 8788 → 容器 8787
docker compose logs -f
```

或手動：

```bash
docker build -t article-import-service:local .
docker run -d --name article-import -p 8788:8787 \
  -e ALLOW_HOSTS="www.bbc.co.uk,*.bbc.com,edition.cnn.com,www.cnn.com" \
  -e MAX_BYTES=8000000 \
  -e REFRESH_ON_BOOT=true \
  article-import-service:local
```

要點：

- **基礎映像**：預設 `node:20-alpine`，可用 `--build-arg NODE_IMAGE=node:22-alpine` 換（本地已有映像或 Docker Hub 拉不動時很有用）。
- **宿主埠**：容器內固定 8787；`docker-compose.yml` 映射到 **8788**，因為 8787 已被其他服務佔用。
- **KV 替代**：Node 版沒有 KV，`FEEDS_CACHE` 不存在時 feed 快取退回行程內記憶體，重啟即失效；`REFRESH_ON_BOOT=true` 可在啟動時先抓一輪。
- **出口 IP 不同**：容器走伺服器自身網路，站點封鎖行為可能與 Cloudflare 出口不同（NYT 這類要用實際部署環境驗收）。
- 健康檢查：映像內建 `HEALTHCHECK` 打 `GET /`。
- `ALLOW_HOSTS='*'` 等於開放代理，**只可在本機測試時短暫使用**。

### 前端接法

`bdc` 的 `ai-config.js`：

```js
export const ARTICLE_IMPORT = {
  PROXY_URL:   'https://article-import-service.lylasi.workers.dev/fetch?url=',
  EXTRACT_URL: 'https://article-import-service.lylasi.workers.dev/extract?url=',
  FEED_URL:    'https://article-import-service.lylasi.workers.dev/feeds',
  SOURCES: [ /* 只在 FEED_URL 失敗時當後備，id 必須與 worker 一致 */ ]
};
```

自架 Docker 版時把上面三個換成 `http://<你的主機>:8788/...`；若前端與服務同源（例如都由同一台伺服器提供），用相對路徑 `/extract?url=` 最省事。
