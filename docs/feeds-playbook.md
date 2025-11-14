# Feeds Playbook

## 新增來源流程
1. 於 `src/lib/config.js` 的 `SOURCES` 物件新增項目：
   ```js
   export const SOURCES = {
     nytimes: {
       label: 'New York Times',
       rss: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
       allowHosts: ['www.nytimes.com'],
       maxItems: 20
     }
   };
   ```
2. 若來源不是 RSS，可提供 `json` handler 或 `customFetcher`。
3. 更新 `docs/api-spec.md` 中的來源列表（可選）。

## Cron 範例
Cloudflare Workers：
```toml
[[triggers]]
crons = ["*/10 * * * *"]
```
Handler：
```js
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshFeeds(env));
  }
};
```

## 開發小技巧
- RSS 解析採 `fast-xml-parser`，若來源需要 auth 或 cookies，可在 `fetcher` 中加入 header。
- 使用 `FEEDS_CACHE` KV 存最近抓取結果，可減少來源壓力。
- 回傳列表時記得 `sort` 與 `slice(0, maxItems)`，避免 payload 過大。
