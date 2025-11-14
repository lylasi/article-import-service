import { HttpError } from '../lib/http.js';

const buckets = new Map();

export function enforceRateLimit(key, { limit = 60, windowMs = 60_000 } = {}) {
  if (!key) return;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt < now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new HttpError(429, 'Too Many Requests', `Limit ${limit} per ${windowMs / 1000}s`);
  }
}

export function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}
