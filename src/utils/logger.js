export const logger = {
  info: (...args) => console.log('[article-service]', ...args),
  warn: (...args) => console.warn('[article-service]', ...args),
  error: (...args) => console.error('[article-service]', ...args)
};
