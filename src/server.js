import { Hono } from 'hono';
import { corsHeaders, jsonResponse } from './lib/http.js';
import { handleFetch } from './routes/fetch.js';
import { handleExtract } from './routes/extract.js';
import { handleFeedsList, handleFeedDetail, handleFeedRefresh, handleFeedArticle } from './routes/feeds.js';

export function createApp() {
  const app = new Hono();

  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { headers: { ...corsHeaders(), 'content-length': '0' } });
    }
    return next();
  });

  app.get('/', (c) => jsonResponse({ service: 'article-import', status: 'ok' }));

  app.get('/fetch', (c) => handleFetch(c.req.raw, c.env, c.executionCtx));
  app.get('/extract', (c) => handleExtract(c.req.raw, c.env, c.executionCtx));

  app.get('/feeds', (c) => handleFeedsList(c.req.raw, c.env));
  app.get('/feeds/:id', (c) => handleFeedDetail(c.req.raw, c.env, { id: c.req.param('id') }));
  app.get('/feeds/:id/refresh', (c) => handleFeedRefresh(c.req.raw, c.env, { id: c.req.param('id') }));
  app.get('/feeds/:id/article', (c) => handleFeedArticle(c.req.raw, c.env, { id: c.req.param('id') }));

  return app;
}
