import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { refreshAllFeeds } from './lib/feeds.js';

const port = Number(process.env.PORT || 8787);
const app = createApp();
const envBindings = createNodeBindings();

serve({
  fetch: (request) => app.fetch(request, envBindings, createExecutionContext()),
  port
});

console.log(`Article Import Service listening on http://localhost:${port}`);

function createNodeBindings() {
  return {
    ...process.env,
    vars: { ...process.env }
  };
}

function createExecutionContext() {
  return {
    waitUntil(promise) {
      promise.catch((err) => console.error('Background task failed', err));
    }
  };
}

// Optional manual refresh trigger
if (process.env.REFRESH_ON_BOOT === 'true') {
  refreshAllFeeds(envBindings).catch((err) => console.error('Initial refresh failed', err));
}
