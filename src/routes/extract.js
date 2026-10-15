import { fetchRemoteText } from '../lib/fetcher.js';
import { parseArticle } from '../lib/content-parser.js';
import { htmlToMarkdown } from '../lib/markdown.js';
import { errorResponse, htmlResponse, HttpError, jsonResponse, markdownResponse, parseBoolean, createJsonBody } from '../lib/http.js';
import { enforceRateLimit, getClientIp } from '../utils/rate-limit.js';
import { logger } from '../utils/logger.js';

/**
 * @param {Request} request
 * @param {object} env
 * @param {{extraAllowedHosts?: string[]}} [options] 由 /feeds/:id/article 傳入該來源宣告的文章主機
 */
export async function handleExtract(request, env, options = {}) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const keepImages = parseBoolean(url.searchParams.get('keepImages'), false);
  const includeMarkdown = parseBoolean(url.searchParams.get('includeMarkdown'), false) || format === 'markdown';
  const mode = (url.searchParams.get('mode') || 'readability').toLowerCase();

  if (!target) {
    return errorResponse(new HttpError(400, 'Missing url query parameter'));
  }

  try {
    enforceRateLimit(getClientIp(request), { limit: 40, windowMs: 60_000 });
    const { html, finalUrl } = await fetchRemoteText(target, env, {
      extraAllowedHosts: options.extraAllowedHosts || []
    });

    if (mode === 'raw') {
      return respondRaw(html, finalUrl, format, keepImages);
    }

    const article = parseArticle(html, finalUrl, { imageOptions: { keepDataImages: keepImages } });
    const markdown = includeMarkdown ? htmlToMarkdown(article.contentHtml, { keepImages }) : null;

    if (format === 'markdown') {
      return markdownResponse(markdown || '');
    }

    if (format === 'html') {
      return htmlResponse(article.contentHtml || '');
    }

    return jsonResponse(
      createJsonBody({
        title: article.title,
        byline: article.byline,
        sourceUrl: finalUrl,
        contentHtml: article.contentHtml,
        contentText: article.contentText,
        markdown,
        publishedAt: article.publishedAt,
        images: article.images,
        rawHtml: article.rawHtml
      })
    );
  } catch (error) {
    // errorResponse 只會回 500，真正的原因要在這裡留下來（wrangler tail 看得到）
    if (!(error instanceof HttpError)) {
      logger.error('extract failed', target, error?.stack || error);
    }
    return errorResponse(error);
  }
}

function respondRaw(html, finalUrl, format, keepImages) {
  if (format === 'markdown') {
    return markdownResponse(htmlToMarkdown(html, { keepImages }));
  }
  if (format === 'html') {
    return htmlResponse(html);
  }
  return jsonResponse(
    createJsonBody({
      title: '',
      byline: '',
      sourceUrl: finalUrl,
      contentHtml: html,
      contentText: stripHtml(html),
      markdown: null,
      publishedAt: null,
      images: [],
      rawHtml: html
    })
  );
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
