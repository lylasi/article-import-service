# Article Import Service

文章採集與清理服務：把新聞網址抓成乾淨的正文與 Markdown，供前端（例如 `bdc` 背單詞應用的「導入文章」）使用。
同一份程式碼可部署成 **Cloudflare Worker** 或 **Docker / Node**。

- 線上 Worker：`https://article-import-service.lylasi.workers.dev`
- 主要使用端：`bdc`（`ARTICLE_IMPORT.EXTRACT_URL` / `PROXY_URL` / `FEED_URL`）

## API

| 端點 | 說明 |
| --- | --- |
| `GET /fetch?url=` | 原樣代理目標 HTML（給需要自己解析的場景） |
| `GET /extract?url=&format=json\|markdown\|html&includeMarkdown=true&keepImages=true` | 抓取 → Readability 解析 → 回 `{title, byline, publishedAt, contentHtml, contentText, markdown, images}` |
| `GET /feeds` | 列出所有來源 |
| `GET /feeds/:id` | 取得該來源的最新條目（KV 快取 `FEED_CACHE_TTL` 秒） |
| `GET /feeds/:id/refresh` | 強制刷新該來源 |
| `GET /feeds/:id/article?url=` | 直接抓該來源某一則的正文（會額外檢查該來源的 `allowHosts`） |

## 快速開始

```bash
npm install
npm run dev        # Cloudflare Workers（wrangler dev）
npm run dev:node   # Node（Hono，預設 http://localhost:8787）
npm test           # vitest
```

## 內建來源（11 個）

`src/lib/config.js` 的 `DEFAULT_SOURCES` 是唯一來源清單；前端是動態讀 `/feeds` 的，改這裡重新部署即可。

| id | 來源 | 說明 |
| --- | --- | --- |
| `bbc` | BBC World | 圖文完整 |
| `timeforkids` | TIME for Kids | 兒童時事，篇幅短、配圖多，最適合小學生 |
| `snexplores` | Science News Explores | 學生向科普，含 Power Words 生詞 |
| `sciencedaily` | ScienceDaily | 科普，正文最乾淨 |
| `conversation` | The Conversation | 學者撰稿、CC 授權長文 |
| `guardian` | The Guardian | 無付費牆、圖片多 |
| `npr` | NPR World | 美國公共廣播 |
| `abcau` | ABC News (AU) | 亞太視角 |
| `goodnews` | Good News Network | 正向新聞，適合小孩 |
| `cnn` | CNN World | 長文／live 稿 |
| `rt` | RT News | — |

### 新增來源的兩個坑

1. **`SOURCES_JSON` 一旦非空就會完全取代內建清單**（`parseSources()`），所以要嘛留 `"{}"`，要嘛把所有要保留的來源都寫進去。
2. **該來源的「文章主機」要加進 `ALLOW_HOSTS`**（feed 主機不用，抓 feed 時會自動臨時加白）。否則 `/extract` 會回 `Host ... is not allowed`。
   - 常見落差：BBC 的 feed 在 `feeds.bbci.co.uk`、文章在 `www.bbc.co.uk`；CNN 的 feed 給 `www.cnn.com`、實際會轉到 `edition.cnn.com`；RT 的 feed 給 `rt-english.com`。
   - `/feeds/:id/article` 會把該來源的 `allowHosts` 當成本次請求的額外放行清單，所以只從新聞來源列表導入時不必先改 `ALLOW_HOSTS`；但直接打 `/extract` 仍受全域白名單限制。

### 實測過的來源（2026-10）

- 可用但未啟用：`techcrunch`、`theverge`、`rthk`（香港電台，純短訊）。
- 會間歇性失敗：**CBC**（`www.cbc.ca` 從 Cloudflare 出口回 520，本機直連卻是 200），所以不列入內建。
- 不建議接：NYT、France 24（站點封鎖伺服器抓取，回 403）；VOA Learning English（文章頁 JS 渲染，正文只剩導覽）；Breaking News English（readability 抓到練習題而非文章）；Al Jazeera（多為影片頁）；DOGOnews／Sky News／Phys.org／Smithsonian／Ars Technica（反爬 403/405）；DW／Taipei Times／KidsNews／News in Levels（RDF 或非 RSS/Atom，本服務只認 `rss.channel` 與 `feed.entry`）。

## 部署

### Cloudflare Workers

```bash
npx wrangler deploy
```

`wrangler.toml` 內已填好 KV namespace 與變數。注意：**若先前用 Dashboard / API 改過這個 Worker，`wrangler deploy` 會以本地程式碼與設定覆蓋**（wrangler 會提示確認）。

### Docker / Node

```bash
# 直接用 compose（宿主埠 8788，避開已被佔用的 8787）
docker compose up -d --build

# 或手動
docker build -t article-import-service:local .
docker run -d --name article-import -p 8788:8787 \
  -e ALLOW_HOSTS="$(grep ^ALLOW_HOSTS wrangler.toml | cut -d'"' -f2)" \
  -e REFRESH_ON_BOOT=true \
  article-import-service:local
```

- 基礎映像可用 `--build-arg NODE_IMAGE=node:22-alpine` 覆寫（離線或本地已有映像時很方便）。
- Node 版沒有 KV，feed 快取是**行程內記憶體**，重啟即失效；`REFRESH_ON_BOOT=true` 會在啟動時先抓一輪。
- 對外抓取走伺服器自身 IP，所以站點封鎖行為可能與 Cloudflare 出口不同。

## 檔案結構

```
src/index.js          Workers 入口（default fetch / scheduled）
src/index-node.js     Node 入口（@hono/node-server）
src/server.js         Hono 路由註冊
src/routes/           fetch / extract / feeds
src/lib/              config、fetcher、content-parser、markdown、images、feeds、http
src/utils/            logger、rate-limit（40 次/分鐘/IP）
tests/                vitest
```

## 已知限制與踩坑記錄

- **Markdown 轉換不要用 turndown**：它在 Worker 裡會走 Node 分支要 `document`，直接 `ReferenceError: document is not defined`（線上實測 500）。現在 `src/lib/markdown.js` 是基於 linkedom 的自寫實作。
- **大頁面**：CNN 文章頁實測 6.17MB，`MAX_BYTES` 預設 8MB；解析前會先移除 `script/style/noscript/template/svg/iframe`（`slimHtmlForParsing`），CNN 解析峰值記憶體 147MB → 77MB、3.7s → 1.4s，輸出完全不變。**不要**連 `nav/header/aside` 一起清，有些站點（Science News Explores）正文就在那些容器裡。
- **速率限制**：`/extract` 每 IP 40 次/分鐘，超過回 429。
- **私有網域**：`localhost`、內網 IP 一律拒絕（SSRF 防護）。
- 目錄下的 `article-import-service.md` 是最初的設計草案，實作以 `src/` 與 `docs/` 為準。
