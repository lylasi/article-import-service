import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { extractImages } from './images.js';

export function parseArticle(html, url, options = {}) {
  const { document } = parseHTML(html);
  sanitizeDocument(document);
  const readability = new Readability(document, {
    debug: false,
    convertEntities: true
  });
  const article = readability.parse() || {};
  const meta = collectMetadata(document);
  const contentHtml = article.content || document.body?.innerHTML || '';
  const contentText = article.textContent || document.body?.textContent || '';
  const publishedAt = meta.publishedAt || article.publishedTime || null;
  const title = article.title || meta.title || meta.ogTitle || '';
  const byline = article.byline || meta.author || meta.byline || '';
  const images = extractImages(document, url, options.imageOptions || {});

  return {
    title,
    byline,
    contentHtml,
    contentText,
    publishedAt,
    sourceUrl: url,
    images,
    rawHtml: html,
    meta
  };
}

function sanitizeDocument(document) {
  document.querySelectorAll('script,style,noscript,iframe').forEach((node) => node.remove());
}

function collectMetadata(document) {
  const meta = {};
  document.querySelectorAll('meta').forEach((node) => {
    const key = node.getAttribute('property') || node.getAttribute('name');
    if (!key) return;
    const value = node.getAttribute('content');
    if (!value) return;
    meta[key.toLowerCase()] = value;
  });

  const publishedCandidates = [
    meta['article:published_time'],
    meta['og:pubdate'],
    meta['pubdate'],
    meta['date'],
    extractTimeElement(document)
  ].filter(Boolean);

  meta.publishedAt = publishedCandidates.map(toIsoString).find(Boolean) || null;
  meta.title = document.querySelector('title')?.textContent || null;
  meta.byline = document.querySelector('[rel="author"], .byline, .author')?.textContent?.trim() || null;
  meta.author = meta['author'] || meta.byline;
  meta.ogTitle = meta['og:title'] || null;
  return meta;
}

function extractTimeElement(document) {
  const timeNode = document.querySelector('time[datetime], time');
  if (!timeNode) return null;
  return timeNode.getAttribute('datetime') || timeNode.textContent;
}

function toIsoString(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
