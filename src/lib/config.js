const DEFAULT_ALLOW_HOSTS = [
  'www.rt.com',
  '*.rt.com',
  'feeds.bbci.co.uk',
  '*.bbc.co.uk',
  '*.bbc.com',
  'edition.cnn.com',
  'rss.cnn.com',
  '*.nytimes.com',
  'rss.nytimes.com'
];

export const DEFAULT_SOURCES = {
  rt: {
    label: 'RT News',
    type: 'rss',
    rss: 'https://www.rt.com/rss/news/',
    description: 'RT world news feed',
    allowHosts: ['www.rt.com'],
    maxItems: 20
  },
  bbc: {
    label: 'BBC World',
    type: 'rss',
    rss: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    description: 'BBC World feed',
    allowHosts: ['www.bbc.com', 'www.bbc.co.uk'],
    maxItems: 15
  },
  cnn: {
    label: 'CNN World',
    type: 'rss',
    rss: 'https://rss.cnn.com/rss/edition_world.rss',
    description: 'CNN global feed',
    allowHosts: ['edition.cnn.com'],
    maxItems: 20
  },
  nyt: {
    label: 'NYTimes World',
    type: 'rss',
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    description: 'New York Times world news',
    allowHosts: ['www.nytimes.com'],
    maxItems: 20
  }
};

const configCache = new WeakMap();

function parseAllowHosts(value) {
  if (!value) {
    return DEFAULT_ALLOW_HOSTS;
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSources(value) {
  if (!value) {
    return DEFAULT_SOURCES;
  }
  try {
    const data = JSON.parse(value);
    if (typeof data !== 'object' || data === null) {
      return DEFAULT_SOURCES;
    }
    return Object.keys(data).length ? data : DEFAULT_SOURCES;
  } catch (err) {
    console.warn('Failed to parse SOURCES_JSON:', err.message);
    return DEFAULT_SOURCES;
  }
}

export function getConfig(env = {}) {
  if (configCache.has(env)) {
    return configCache.get(env);
  }
  const allowHosts = parseAllowHosts(env.ALLOW_HOSTS || (env.vars && env.vars.ALLOW_HOSTS));
  const maxBytes = Number(env.MAX_BYTES || (env.vars && env.vars.MAX_BYTES) || 4_000_000);
  const sources = parseSources(env.SOURCES_JSON || (env.vars && env.vars.SOURCES_JSON));
  const feedCacheTTL = Number(env.FEED_CACHE_TTL || (env.vars && env.vars.FEED_CACHE_TTL) || 300);
  const config = { allowHosts, maxBytes, sources, feedCacheTTL };
  configCache.set(env, config);
  return config;
}

export function isHostAllowed(hostname, allowHosts) {
  return allowHosts.some((pattern) => matchHostPattern(hostname, pattern));
}

function matchHostPattern(hostname, pattern) {
  if (!pattern) return false;
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // keep the dot
    return hostname === pattern.slice(2) || hostname.endsWith(suffix);
  }
  return hostname === pattern;
}

export function extendAllowHosts(base, extras = []) {
  const set = new Set(base);
  extras.forEach((host) => set.add(host));
  return Array.from(set);
}
