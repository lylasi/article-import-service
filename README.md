# Article Import Service

依據 `article-import-service.md` 建立的文章採集與清理服務。專案同時支援 Cloudflare Workers 與 Docker/Node.js 兩種部署方式，並提供 `/fetch`、`/extract`、`/feeds` API 以輸出 HTML/JSON/Markdown。

## 快速開始

```bash
npm install
npm run dev        # Cloudflare Workers（wrangler dev）
npm run dev:node   # Node 伺服器（Hono）
```

`wrangler.toml` 內可設定 `ALLOW_HOSTS`、`MAX_BYTES`、`SOURCES_JSON` 等環境變數。Node 版本則直接透過系統環境變數提供相同值。

## 目錄
- `src/index.js`：Workers 入口，使用原生 `fetch` router。
- `src/index-node.js`：Node/Hono 入口，和 Worker 共用 routes。
- `src/routes`：`fetch`、`extract`、`feeds` 三個端點。
- `src/lib`：HTTP、內容解析、Markdown、圖片與 feed 工具。
- `src/utils`：logger、rate limit 工具（簡易）。
- `docs/`：API、部署與來源擴充說明。

## 測試

目前範例提供基本單元測試骨架（`vitest`），可依需求擴充。亦可搭配 `miniflare` 在本地模擬 Workers 環境。

## 部署

### Cloudflare Workers
```bash
wrangler deploy
```

### Docker / Node
```bash
docker build -t article-import-service .
docker run -p 8787:8787 \
  -e ALLOW_HOSTS="www.rt.com,*.bbc.com" \
  -e SOURCES_JSON='{"rt":{"label":"RT","rss":"https://www.rt.com/rss/news/"}}' \
  article-import-service
```

更多細節請見 `docs/deployment.md`。
