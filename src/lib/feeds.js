import { XMLParser } from 'fast-xml-parser';
import { getConfig } from './config.js';
import { fetchRemoteText } from './fetcher.js';
import { HttpError } from './http.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

const memoryCache = new Map();

export function listSources(env) {
  const { sources } = getConfig(env);
  return Object.entries(sources).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    type: cfg.type || 'rss',
    description: cfg.description || '',
    hasArticleProxy: true,
    maxItems: cfg.maxItems || 20
  }));
}

export function getSourceConfig(sourceId, env) {
  return resolveSource(sourceId, env);
}

export async function fetchFeedItems(sourceId, env, options = {}) {
  const source = resolveSource(sourceId, env);
  const cacheKey = `feed:${sourceId}`;
  if (!options.forceRefresh) {
    const cached = await readCache(env, cacheKey);
    if (cached) {
      return cached;
    }
  }
  return refreshFeed(sourceId, env);
}

export async function refreshFeed(sourceId, env) {
  const source = resolveSource(sourceId, env);
  const cacheKey = `feed:${sourceId}`;
  const items = await loadFeed(source, env);
  const payload = {
    id: sourceId,
    label: source.label,
    refreshedAt: new Date().toISOString(),
    items: items.slice(0, source.maxItems || 20)
  };
  await writeCache(env, cacheKey, payload);
  return payload;
}

export async function refreshAllFeeds(env) {
  const { sources } = getConfig(env);
  const results = [];
  for (const sourceId of Object.keys(sources)) {
    try {
      const payload = await refreshFeed(sourceId, env);
      results.push(payload);
    } catch (err) {
      console.error(`Failed to refresh feed ${sourceId}`, err);
    }
  }
  return results;
}

async function loadFeed(source, env) {
  if (source.type === 'json') {
    const { html } = await fetchRemoteText(source.json, env, {
      extraAllowedHosts: hostList(source.json)
    });
    const data = JSON.parse(html);
    if (!Array.isArray(data)) {
      throw new HttpError(500, 'JSON feed must be an array');
    }
    return data.map(normalizeJsonFeedItem);
  }

  const feedUrl = source.rss || source.url;
  const { html } = await fetchRemoteText(feedUrl, env, {
    extraAllowedHosts: hostList(feedUrl)
  });
  return parseRss(html);
}

function parseRss(xml) {
  const parsed = parser.parse(xml);
  if (parsed?.rss?.channel) {
    const channel = parsed.rss.channel;
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    return items.filter(Boolean).map(normalizeRssItem);
  }
  if (parsed?.feed?.entry) {
    const entries = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    return entries.filter(Boolean).map(normalizeAtomEntry);
  }
  throw new HttpError(422, 'Unsupported feed format');
}

function normalizeRssItem(item) {
  const link = item.link?.href || item.link?.['@_href'] || item.link || item.guid;
  return {
    title: item.title || 'Untitled',
    url: firstString(link),
    summary: sanitizeText(item.description || item.summary || ''),
    publishedAt: toIso(item.pubDate || item.published || item.updated)
  };
}

function normalizeAtomEntry(entry) {
  const link = Array.isArray(entry.link) ? entry.link.find((l) => l.rel === 'alternate') || entry.link[0] : entry.link;
  return {
    title: entry.title || 'Untitled',
    url: firstString(link?.href || link?.['@_href'] || link),
    summary: sanitizeText(entry.summary || entry.content || ''),
    publishedAt: toIso(entry.published || entry.updated)
  };
}

function normalizeJsonFeedItem(item) {
  return {
    title: item.title || 'Untitled',
    url: item.url || item.link,
    summary: sanitizeText(item.summary || item.description || ''),
    publishedAt: toIso(item.publishedAt || item.pubDate || item.date)
  };
}

function resolveSource(sourceId, env) {
  const { sources } = getConfig(env);
  const source = sources[sourceId];
  if (!source) {
    throw new HttpError(404, `Unknown source: ${sourceId}`);
  }
  return source;
}

function sanitizeText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function firstString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && value['#text']) return value['#text'];
  return value || null;
}

async function readCache(env, key) {
  if (env.FEEDS_CACHE?.get) {
    return env.FEEDS_CACHE.get(key, { type: 'json' });
  }
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
}

async function writeCache(env, key, value) {
  const { feedCacheTTL } = getConfig(env);
  if (env.FEEDS_CACHE?.put) {
    await env.FEEDS_CACHE.put(key, JSON.stringify(value), { expirationTtl: feedCacheTTL });
    return;
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + feedCacheTTL * 1000
  });
}

function hostList(url) {
  try {
    const { hostname } = new URL(url);
    return [hostname];
  } catch (err) {
    return [];
  }
}
