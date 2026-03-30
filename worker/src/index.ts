import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { fuckRoute } from './routes/fuck';
import { statusAllRoute } from './routes/status-all';
import { statusModelRoute } from './routes/status-model';
import { modelsRoute } from './routes/models';
import { updateBaselines } from './cron/update-baselines';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.post('/api/fuck', fuckRoute);
app.get('/api/status', statusAllRoute);
app.get('/api/status/:model', statusModelRoute);
app.get('/api/models', modelsRoute);

export { app };

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(updateBaselines(env));
  },
};
