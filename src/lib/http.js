export class HttpError extends Error {
  constructor(status = 500, message = 'Error', details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    Vary: 'Origin'
  };
}

export function jsonResponse(payload, status = 200, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...headers
    }
  });
}

export function textResponse(text, status = 200, headers = {}) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...corsHeaders(),
      ...headers
    }
  });
}

export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...corsHeaders(),
      ...headers
    }
  });
}

export function markdownResponse(markdown, status = 200, headers = {}) {
  return new Response(markdown, {
    status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      ...corsHeaders(),
      ...headers
    }
  });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: error.message,
        status: error.status,
        details: error.details || null
      },
      error.status,
      { 'cache-control': 'no-store' }
    );
  }
  console.error('Unexpected error:', error);
  return jsonResponse({ error: 'Internal Server Error', status: 500 }, 500, {
    'cache-control': 'no-store'
  });
}

export function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function createJsonBody({ title, byline, sourceUrl, contentHtml, contentText, markdown, publishedAt, images, rawHtml }) {
  return {
    title: title || '',
    byline: byline || '',
    sourceUrl,
    publishedAt: publishedAt || null,
    contentHtml: contentHtml || '',
    contentText: contentText || '',
    markdown: markdown || null,
    images: images || [],
    rawHtml: rawHtml || null
  };
}
