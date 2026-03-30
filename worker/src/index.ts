import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { fuckRoute } from './routes/fuck';
import { statusAllRoute } from './routes/status-all';
import { statusModelRoute } from './routes/status-model';
import { modelsRoute } from './routes/models';
import { fuckTextRoute } from './routes/fuck-text';
import { updateBaselines } from './cron/update-baselines';
import { syncModels } from './cron/sync-models';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.post('/api/fuck', fuckRoute);
app.get('/api/status', statusAllRoute);
app.get('/api/status/:model', statusModelRoute);
app.get('/api/models', modelsRoute);
app.post('/api/fuck/:model/text', fuckTextRoute);

export { app };

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Hourly: update EWMA baselines
    ctx.waitUntil(updateBaselines(env));

    // Weekly (Monday 00:00 UTC): sync models from OpenRouter
    const hour = new Date(event.scheduledTime).getUTCHours();
    const day = new Date(event.scheduledTime).getUTCDay();
    if (day === 1 && hour === 0) {
      ctx.waitUntil(syncModels(env));
    }
  },
};
