import { getConfig, isHostAllowed, extendAllowHosts } from './config.js';
import { HttpError, corsHeaders } from './http.js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export async function requestRemote(targetUrl, env, options = {}) {
  const normalized = normalizeUrl(targetUrl);
  const config = getConfig(env);
  const allowHosts = options.extraAllowedHosts?.length
    ? extendAllowHosts(config.allowHosts, options.extraAllowedHosts)
    : config.allowHosts;

  if (!HTTP_PROTOCOLS.has(normalized.protocol)) {
    throw new HttpError(400, 'Only http/https protocols are allowed');
  }

  if (!isHostAllowed(normalized.hostname, allowHosts)) {
    throw new HttpError(403, `Host ${normalized.hostname} is not allowed`);
  }

  if (isPrivateHostname(normalized.hostname)) {
    throw new HttpError(403, 'Private network addresses are not allowed');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('user-agent')) {
    headers.set('user-agent', 'article-import-service/0.1 (+https://github.com/)');
  }

  const response = await fetch(normalized.toString(), {
    ...options,
    headers
  });

  return { response, finalUrl: response.url || normalized.toString(), config };
}

export async function fetchRemoteText(targetUrl, env, options = {}) {
  const { response, finalUrl, config } = await requestRemote(targetUrl, env, options);
  const limit = options.maxBytes || config.maxBytes;
  enforceContentLengthLimit(response, limit);

  if (!response.ok) {
    throw new HttpError(response.status, `Upstream responded with status ${response.status}`);
  }

  const buffer = await readStreamWithLimit(response.body, limit);
  const decoder = new TextDecoder(options.encoding || 'utf-8');
  const text = decoder.decode(buffer);
  return { html: text, finalUrl, headers: responseHeaders(response) };
}

export async function proxyRemoteResponse(targetUrl, env, options = {}) {
  const { response, config } = await requestRemote(targetUrl, env, options);
  const limit = options.maxBytes || config.maxBytes;
  enforceContentLengthLimit(response, limit);
  const stream = limitStream(response.body, limit);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  options.overrideContentType && headers.set('content-type', options.overrideContentType);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'private, max-age=60');
  }
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function normalizeUrl(value) {
  try {
    return new URL(value);
  } catch (err) {
    throw new HttpError(400, 'Invalid URL');
  }
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0') return true;
  if (host === '::1') return true;
  if (isLoopback(host)) return true;
  if (isPrivateIpv4(host)) return true;
  return false;
}

function isLoopback(host) {
  return host.startsWith('127.');
}

function isPrivateIpv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  if (host.startsWith('10.')) return true;
  if (host.startsWith('192.168.')) return true;
  if (host.startsWith('172.')) {
    const [, second] = host.split('.').map(Number);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function enforceContentLengthLimit(response, limit) {
  const lengthHeader = response.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > limit) {
    throw new HttpError(413, `Remote payload (${lengthHeader}) exceeds limit ${limit}`);
  }
}

function responseHeaders(response) {
  const result = {};
  for (const [key, value] of response.headers.entries()) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function limitStream(stream, limit) {
  if (!stream) {
    return null;
  }
  const reader = stream.getReader();
  let consumed = 0;
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      consumed += value.byteLength;
      if (consumed > limit) {
        controller.error(new HttpError(413, 'Payload exceeded limit'));
        reader.cancel();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason);
    }
  });
}

async function readStreamWithLimit(stream, limit) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      throw new HttpError(413, 'Payload exceeded limit');
    }
    chunks.push(value);
  }
  return concatUint8Arrays(chunks, total);
}

function concatUint8Arrays(chunks, total) {
  if (chunks.length === 1) return chunks[0];
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
