import type { Context } from 'hono';
import type { Env, FuckResponse } from '../types';
import { hashIP } from '../lib/hash';
import { computeHourBucket } from '../lib/baseline';
import { loadAllModelBaselines } from '../lib/baseline-resolver';
import { scoreModel, scoreAllModels } from '../lib/model-scorer';

export async function fuckRoute(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ model?: string }>().catch(() => ({}));
  if (!body.model) {
    return c.json({ error: 'model is required' }, 400);
  }

  const model = body.model;

  const modelInfo = await c.env.DB.prepare(
    'SELECT slug, display_name, provider FROM models WHERE slug = ?',
  )
    .bind(model)
    .first<{ slug: string; display_name: string; provider: string }>();

  if (!modelInfo) {
    return c.json({ error: `unknown model: ${model}` }, 400);
  }

  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  // Rate limit
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '0.0.0.0';
  const ipHash = await hashIP(ip);
  const rlKey = `rl:${ipHash}:${hour_bucket}`;
  const rlCount = parseInt((await c.env.RATE_LIMIT.get(rlKey)) || '0', 10);
  if (rlCount >= 30) {
    return c.json({ error: 'rate limited: max 30 fucks per hour' }, 429);
  }
  await c.env.RATE_LIMIT.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // Record the fuck
  await c.env.DB.prepare(
    `INSERT INTO fucks (model, ip_hash, hour_bucket, day_of_week, hour_of_day)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ip_hash, model, hour_bucket) DO UPDATE SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  )
    .bind(model, ipHash, hour_bucket, day_of_week, hour_of_day)
    .run();

  // Load all data needed for scoring — single batch for all models
  const [currentRow, totalRow, allBaselines, allModels, fuckCounts, allShares] = await Promise.all([
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
    ).bind(model, hour_bucket).first<{ count: number }>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
    ).bind(hour_bucket).first<{ count: number }>(),

    loadAllModelBaselines(c.env.DB, day_of_week, hour_of_day),

    c.env.DB.prepare(
      'SELECT slug, display_name, provider, sort_order FROM models ORDER BY sort_order',
    ).all<{ slug: string; display_name: string; provider: string; sort_order: number }>(),

    c.env.DB.prepare(
      'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? GROUP BY model',
    ).bind(hour_bucket).all<{ model: string; fuck_count: number }>(),

    c.env.DB.prepare(
      'SELECT model, expected_share FROM model_shares',
    ).all<{ model: string; expected_share: number }>(),
  ]);

  const currentFucks = currentRow?.count || 0;
  const totalFucks = totalRow?.count || 1;
  const shareMap = new Map(allShares.results.map((s) => [s.model, s.expected_share]));
  const expectedShare = shareMap.get(model) || 0;
  const currentShare = totalFucks > 0 ? currentFucks / totalFucks : 0;

  // Score this model (extract its baselines from the batch result)
  const baselines = allBaselines.get(model) || { slot: null, hour: null, aggregate: null };
  const result = scoreModel(currentFucks, totalFucks, baselines, expectedShare);

  // Score other models
  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));
  const otherModels = scoreAllModels(
    allModels.results.filter((m) => m.slug !== model),
    countMap,
    totalFucks,
    allBaselines,
    shareMap,
  );

  const response: FuckResponse = {
    ok: true,
    model,
    display_name: modelInfo.display_name,
    current_fucks: currentFucks,
    baseline_mean: result.baseline_mean ?? 0,
    z_score: result.z_score,
    current_share: Math.round(currentShare * 1000) / 1000,
    expected_share: Math.round(expectedShare * 1000) / 1000,
    disproportionality: result.disproportionality,
    fuck_score: result.fuck_score,
    status: result.status,
    other_models: otherModels,
  };

  return c.json(response, 201);
}
