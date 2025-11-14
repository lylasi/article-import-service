const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

export function extractImages(document, baseUrl, options = {}) {
  const minWidth = options.minWidth || MIN_WIDTH;
  const minHeight = options.minHeight || MIN_HEIGHT;
  const keepDataImages = options.keepDataImages || false;
  const seen = new Set();
  const results = [];

  document.querySelectorAll('img').forEach((node) => {
    const normalized = normalizeImageNode(node, baseUrl, { minWidth, minHeight, keepDataImages });
    if (!normalized) return;
    if (seen.has(normalized.url)) return;
    seen.add(normalized.url);
    results.push(normalized);
  });

  return results;
}

export function normalizeImageNode(img, baseUrl, options = {}) {
  const src = pickSource(img);
  if (!src) return null;
  if (!options.keepDataImages && src.startsWith('data:')) return null;
  if (isTrackingPixel(src)) return null;

  const absoluteUrl = absolutize(src, baseUrl);
  if (!absoluteUrl) return null;

  const width = parseInt(img.getAttribute('width') || img.getAttribute('data-width') || '0', 10);
  const height = parseInt(img.getAttribute('height') || img.getAttribute('data-height') || '0', 10);

  if (width && width < (options.minWidth || MIN_WIDTH)) return null;
  if (height && height < (options.minHeight || MIN_HEIGHT)) return null;

  const caption =
    img.getAttribute('alt')?.trim() ||
    img.getAttribute('title')?.trim() ||
    img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
    null;

  return {
    url: absoluteUrl,
    caption,
    width: width || null,
    height: height || null,
    role: deriveRole(img)
  };
}

function pickSource(img) {
  const candidates = [
    img.getAttribute('data-srcset'),
    img.getAttribute('data-src'),
    img.getAttribute('data-original'),
    img.getAttribute('srcset'),
    img.getAttribute('src')
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes(',')) {
      const parsed = parseSrcset(candidate);
      if (parsed) return parsed;
    }
    return candidate.trim();
  }
  return null;
}

function parseSrcset(value) {
  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [url, size] = item.split(/\s+/);
      const width = size ? Number(size.replace(/w$/, '')) : 0;
      return { url, width };
    })
    .sort((a, b) => b.width - a.width);
  return parts[0]?.url || null;
}

function absolutize(url, base) {
  try {
    return new URL(url, base).toString();
  } catch (err) {
    return null;
  }
}

function isTrackingPixel(url) {
  const lower = url.toLowerCase();
  if (lower.includes('spacer') || lower.includes('tracking')) return true;
  if (lower.endsWith('.gif') && (lower.includes('pixel') || lower.includes('track'))) return true;
  return false;
}

function deriveRole(img) {
  const className = img.getAttribute('class') || '';
  if (className.includes('hero')) return 'hero';
  if (className.includes('thumb')) return 'thumbnail';
  return 'inline';
}
