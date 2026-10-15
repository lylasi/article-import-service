// 允許抓取的主機。原則：
//   1. feed 主機不必列在這裡（抓 feed 時會用 extraAllowedHosts 臨時加白）；
//   2. 「文章主機」一定要列，否則 /extract 會回 `Host ... is not allowed`。
// 常見踩坑：BBC 的 feed 在 feeds.bbci.co.uk、文章在 www.bbc.co.uk；CNN 的 feed 給
// www.cnn.com、實際會轉到 edition.cnn.com；RT 的 feed 給 rt-english.com。
const DEFAULT_ALLOW_HOSTS = [
  // RT
  'www.rt.com',
  'rt-english.com',
  '*.rt.com',
  // BBC
  'feeds.bbci.co.uk',
  '*.bbc.co.uk',
  '*.bbc.com',
  // CNN
  'edition.cnn.com',
  'www.cnn.com',
  '*.cnn.com',
  'rss.cnn.com',
  // 學生向
  'www.timeforkids.com',
  'www.snexplores.org',
  'www.sciencedaily.com',
  'theconversation.com',
  // 一般新聞
  'www.theguardian.com',
  'www.npr.org',
  'text.npr.org',
  'www.abc.net.au',
  // 正向新聞
  'www.goodnewsnetwork.org'
];

// 內建來源。注意 SOURCES_JSON 一旦非空就會「完全取代」這份清單，
// 所以用變數覆寫時必須把所有要保留的來源都寫進去。
export const DEFAULT_SOURCES = {
  bbc: {
    label: 'BBC World',
    type: 'rss',
    rss: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    description: 'BBC 世界新聞，圖文完整',
    allowHosts: ['www.bbc.com', 'www.bbc.co.uk'],
    maxItems: 15
  },
  timeforkids: {
    label: 'TIME for Kids',
    type: 'rss',
    rss: 'https://www.timeforkids.com/feed/',
    description: '兒童時事，篇幅短、配圖多，最適合小學生',
    allowHosts: ['www.timeforkids.com'],
    maxItems: 20
  },
  snexplores: {
    label: 'Science News Explores',
    type: 'rss',
    rss: 'https://www.snexplores.org/feed',
    description: '學生向科普，含 Power Words 生詞',
    allowHosts: ['www.snexplores.org'],
    maxItems: 20
  },
  sciencedaily: {
    label: 'ScienceDaily',
    type: 'rss',
    rss: 'https://www.sciencedaily.com/rss/top/science.xml',
    description: '科普，正文乾淨無廣告',
    allowHosts: ['www.sciencedaily.com'],
    maxItems: 20
  },
  conversation: {
    label: 'The Conversation',
    type: 'rss',
    rss: 'https://theconversation.com/articles.atom',
    description: '學者撰稿、CC 授權長文',
    allowHosts: ['theconversation.com'],
    maxItems: 20
  },
  guardian: {
    label: 'The Guardian',
    type: 'rss',
    rss: 'https://www.theguardian.com/world/rss',
    description: '英國衛報國際版，無付費牆、圖片多',
    allowHosts: ['www.theguardian.com'],
    maxItems: 20
  },
  npr: {
    label: 'NPR World',
    type: 'rss',
    rss: 'https://feeds.npr.org/1004/rss.xml',
    description: '美國公共廣播，文字乾淨',
    allowHosts: ['www.npr.org', 'text.npr.org'],
    maxItems: 20
  },
  abcau: {
    label: 'ABC News (AU)',
    type: 'rss',
    rss: 'https://www.abc.net.au/news/feed/51120/rss.xml',
    description: '澳洲 ABC，亞太視角',
    allowHosts: ['www.abc.net.au'],
    maxItems: 20
  },
  goodnews: {
    label: 'Good News Network',
    type: 'rss',
    rss: 'https://www.goodnewsnetwork.org/feed/',
    description: '正向新聞，適合小孩',
    allowHosts: ['www.goodnewsnetwork.org'],
    maxItems: 20
  },
  cnn: {
    label: 'CNN World',
    type: 'rss',
    rss: 'http://rss.cnn.com/rss/edition_world.rss',
    description: 'CNN 國際版',
    allowHosts: ['edition.cnn.com', 'www.cnn.com', '*.cnn.com'],
    maxItems: 20
  },
  rt: {
    label: 'RT News',
    type: 'rss',
    rss: 'https://www.rt.com/rss/news/',
    description: 'RT 國際新聞',
    allowHosts: ['www.rt.com', 'rt-english.com'],
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
  const maxBytes = Number(env.MAX_BYTES || (env.vars && env.vars.MAX_BYTES) || 8_000_000);
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
