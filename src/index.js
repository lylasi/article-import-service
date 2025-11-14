import { createApp } from './server.js';
import { refreshAllFeeds } from './lib/feeds.js';

const app = createApp();

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshAllFeeds(env));
  }
};
