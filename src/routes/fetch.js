import { proxyRemoteResponse } from '../lib/fetcher.js';
import { HttpError, errorResponse } from '../lib/http.js';
import { enforceRateLimit, getClientIp } from '../utils/rate-limit.js';

export async function handleFetch(request, env) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return errorResponse(new HttpError(400, 'Missing url query parameter'));
  }
  try {
    enforceRateLimit(getClientIp(request));
    return await proxyRemoteResponse(target, env);
  } catch (error) {
    return errorResponse(error);
  }
}
