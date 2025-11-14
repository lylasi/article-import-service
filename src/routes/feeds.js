import { listSources, fetchFeedItems, refreshFeed, getSourceConfig } from '../lib/feeds.js';
import { errorResponse, HttpError, jsonResponse, parseBoolean } from '../lib/http.js';
import { isHostAllowed } from '../lib/config.js';
import { handleExtract } from './extract.js';

export async function handleFeedsList(request, env) {
  try {
    return jsonResponse({ sources: listSources(env) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleFeedDetail(request, env, params = {}) {
  const sourceId = params.id;
  if (!sourceId) {
    return errorResponse(new HttpError(400, 'Feed id is required'));
  }
  const url = new URL(request.url);
  const refresh = parseBoolean(url.searchParams.get('refresh'), false);
  try {
    const data = await fetchFeedItems(sourceId, env, { forceRefresh: refresh });
    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleFeedRefresh(request, env, params = {}) {
  const sourceId = params.id;
  if (!sourceId) {
    return errorResponse(new HttpError(400, 'Feed id is required'));
  }
  try {
    const payload = await refreshFeed(sourceId, env);
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleFeedArticle(request, env, params = {}) {
  const sourceId = params.id;
  if (!sourceId) {
    return errorResponse(new HttpError(400, 'Feed id is required'));
  }
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return errorResponse(new HttpError(400, 'Missing url query parameter'));
  }
  try {
    const source = getSourceConfig(sourceId, env);
    if (Array.isArray(source.allowHosts) && source.allowHosts.length) {
      const hostname = new URL(target).hostname;
      if (!isHostAllowed(hostname, source.allowHosts)) {
        throw new HttpError(403, `URL host ${hostname} is not permitted for ${sourceId}`);
      }
    }
    return handleExtract(request, env);
  } catch (error) {
    return errorResponse(error);
  }
}
