# API 規格

## /fetch
- `GET /fetch?url=`
- 參數：`url`（必填）
- 回傳：原始 HTML，會帶 `Access-Control-Allow-Origin: *`
- 驗證：僅允許 http/https、限制白名單、阻擋私有網域、檔案大小超過 `MAX_BYTES` 會被拒絕。

## /extract
- `GET /extract?url=...&format=json|html|markdown&keepImages=true|false&mode=readability|raw`
- 預設 `format=json`、`keepImages=false`、`mode=readability`。
- 回傳 JSON：
```json
{
  "title": "string",
  "byline": "string",
  "publishedAt": "ISO Date",
  "sourceUrl": "string",
  "contentHtml": "<p>...</p>",
  "contentText": "純文字",
  "markdown": "可選",
  "images": [
    { "url": "https://", "caption": "", "width": 1200, "height": 800, "role": "hero" }
  ],
  "rawHtml": "<!doctype html>..."
}
```
- `format=markdown`：僅輸出 Markdown 文字。
- `format=html`：輸出 `contentHtml`。

## /feeds
- `GET /feeds`：列出系統內所有來源（`id`, `label`, `type`, `description`, `hasArticleProxy`）。
- `GET /feeds/:id`：回傳來源最新文章列表，欄位包含 `title`, `url`, `summary`, `publishedAt`。
- `GET /feeds/:id/article?url=...&format=`：包裝 `/extract`，提供直接抽取功能。

## 錯誤格式
```json
{
  "error": "Bad Request",
  "status": 400,
  "details": "URL is required"
}
```
