# Feeds Playbook

## 新增來源流程

1. 在 `src/lib/config.js` 的 `DEFAULT_SOURCES` 加一項（**不是**舊文件寫的 `SOURCES`）：

   ```js
   export const DEFAULT_SOURCES = {
     techcrunch: {
       label: 'TechCrunch',
       type: 'rss',              // 'rss' | 'json'
       rss: 'https://techcrunch.com/feed/',
       description: '科技新聞',
       allowHosts: ['techcrunch.com'],   // 這個來源允許抓的文章主機
       maxItems: 20
     }
   };
   ```

2. 把該來源的**文章主機**加進 `DEFAULT_ALLOW_HOSTS`（同一檔案）或部署變數 `ALLOW_HOSTS`。
   feed 主機不用加：抓 feed 時會用 `extraAllowedHosts` 臨時放行 feed 自己的網域。
3. `npm test` → `npx wrangler deploy`。
4. 想先驗證再上線：`npm run dev`（wrangler dev）後打 `/feeds/<id>` 與 `/feeds/<id>/article?url=`。

> 只想臨時加來源、不想改程式碼時，可用 `SOURCES_JSON` 環境變數；但它是**整份取代**，必須包含所有要保留的來源。

## 挑來源的檢查清單

一個來源能不能用，取決於三件事，建議照順序驗：

1. **feed 解析得動**：`fast-xml-parser` 只認 `rss.channel.item` 與 `feed.entry`。RDF（`rdf:RDF`，例如 DW）與各種私有 JSON 會回 422。
2. **文章主機沒被站點擋**：feed 抓得到不代表文章抓得到。務必用部署環境（Cloudflare 出口 / 伺服器 IP）實測一次——本機 IP 過得了、Cloudflare 出口被擋是常態（NYT、France 24 就是這樣）。
3. **正文抽得乾淨**：Readability 對 JS 渲染的站點（VOA Learning English）與把正文放在奇怪容器的站點（Breaking News English）會失敗。驗收指標：Markdown 字數、圖片數，以及 **`](` 連結數**（導覽噪音）。

2026-10 的實測結果與最終選用的 12 個來源，見 `README.md` 的「內建來源」段落。

## Cron 預抓（選用）

`wrangler.toml`：

```toml
[[triggers]]
crons = ["*/10 * * * *"]
```

`src/index.js` 已有 `scheduled` handler 會呼叫 `refreshAllFeeds(env)`。
**目前線上沒有開**：feed 是「按需抓取 + KV 快取 `FEED_CACHE_TTL` 秒」，開 cron 只會多花請求數。
Node 版可用 `REFRESH_ON_BOOT=true` 在啟動時先抓一輪，或用外部 scheduler 打 `/feeds/:id/refresh`。

## 開發小技巧

- `FEEDS_CACHE`（KV）存最近一次抓取結果；Node 版退回行程內記憶體。
- 若來源需要特定 header／cookie，在 `src/lib/fetcher.js` 的 `requestRemote` 加。
- 回傳前記得 `slice(0, maxItems)`，避免 payload 過大。
- 大頁面請搭配 `slimHtmlForParsing`（`src/lib/content-parser.js`）——它在解析前先砍掉對正文無用的巨型節點。
