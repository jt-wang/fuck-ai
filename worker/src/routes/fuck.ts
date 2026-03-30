import type { Context } from 'hono';
import type { Env, FuckResponse } from '../types';
import { hashIP } from '../lib/hash';
import { computeHourBucket } from '../lib/baseline';
import { computeZScore, computeDisproportionality, computeFuckScore, scoreToStatus } from '../lib/scoring';

export async function fuckRoute(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ model?: string }>().catch(() => ({}));
  if (!body.model) {
    return c.json({ error: 'model is required' }, 400);
  }

  const model = body.model;

  // Validate model exists
  const modelInfo = await c.env.DB.prepare(
    'SELECT slug, display_name, provider FROM models WHERE slug = ?',
  )
    .bind(model)
    .first<{ slug: string; display_name: string; provider: string }>();

  if (!modelInfo) {
    return c.json({ error: `unknown model: ${model}` }, 400);
  }

  // Compute hour bucket
  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  // Hash IP for dedup
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '0.0.0.0';
  const ipHash = await hashIP(ip);

  // Rate limit: 30 fucks/hour/IP across all models
  const rlKey = `rl:${ipHash}:${hour_bucket}`;
  const rlCount = parseInt((await c.env.RATE_LIMIT.get(rlKey)) || '0', 10);
  if (rlCount >= 30) {
    return c.json({ error: 'rate limited: max 30 fucks per hour' }, 429);
  }
  await c.env.RATE_LIMIT.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // Insert (dedup via UNIQUE index — upsert to allow changing within hour)
  await c.env.DB.prepare(
    `INSERT INTO fucks (model, ip_hash, hour_bucket, day_of_week, hour_of_day)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ip_hash, model, hour_bucket) DO UPDATE SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  )
    .bind(model, ipHash, hour_bucket, day_of_week, hour_of_day)
    .run();

  // Get current fucks for this model this hour
  const currentRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
  )
    .bind(model, hour_bucket)
    .first<{ count: number }>();
  const currentFucks = currentRow?.count || 0;

  // Get total fucks this hour (all models)
  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
  )
    .bind(hour_bucket)
    .first<{ count: number }>();
  const totalFucks = totalRow?.count || 1;

  // Layer 1: Self-referencing baseline (Downdetector method)
  const baseline = await c.env.DB.prepare(
    'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
  )
    .bind(model, day_of_week, hour_of_day)
    .first<{ ewma_mean: number; ewma_std: number; sample_count: number }>();

  const baselineMean = baseline?.ewma_mean || 0;
  const baselineStd = baseline?.ewma_std || 1;
  const sampleCount = baseline?.sample_count || 0;
  const zScore = computeZScore(currentFucks, baselineMean, baselineStd);

  // Layer 2: Cross-model PRR (FDA method)
  const modelShare = await c.env.DB.prepare(
    'SELECT expected_share FROM model_shares WHERE model = ?',
  )
    .bind(model)
    .first<{ expected_share: number }>();

  const currentShare = totalFucks > 0 ? currentFucks / totalFucks : 0;
  const expectedShare = modelShare?.expected_share || 0;
  const disproportionality = computeDisproportionality(currentShare, expectedShare);

  // Combined score
  const fuckScore = sampleCount >= 10 ? computeFuckScore(zScore, disproportionality) : 0;
  const status = scoreToStatus(fuckScore);

  // Get other models' status for context
  const allModels = await c.env.DB.prepare(
    'SELECT slug, display_name, provider, sort_order FROM models ORDER BY sort_order',
  ).all<{ slug: string; display_name: string; provider: string; sort_order: number }>();

  const fuckCounts = await c.env.DB.prepare(
    'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? GROUP BY model',
  )
    .bind(hour_bucket)
    .all<{ model: string; fuck_count: number }>();

  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));

  const allBaselines = await c.env.DB.prepare(
    'SELECT model, ewma_mean, ewma_std, sample_count FROM baselines WHERE day_of_week = ? AND hour_of_day = ?',
  )
    .bind(day_of_week, hour_of_day)
    .all<{ model: string; ewma_mean: number; ewma_std: number; sample_count: number }>();
  const baselineMap = new Map(allBaselines.results.map((b) => [b.model, b]));

  const allShares = await c.env.DB.prepare(
    'SELECT model, expected_share FROM model_shares',
  ).all<{ model: string; expected_share: number }>();
  const shareMap = new Map(allShares.results.map((s) => [s.model, s.expected_share]));

  const otherModels = allModels.results
    .filter((m) => m.slug !== model)
    .map((m) => {
      const mFucks = countMap.get(m.slug) || 0;
      const mBaseline = baselineMap.get(m.slug);
      const mZ = mBaseline ? computeZScore(mFucks, mBaseline.ewma_mean, mBaseline.ewma_std) : 0;
      const mShare = totalFucks > 0 ? mFucks / totalFucks : 0;
      const mExpected = shareMap.get(m.slug) || 0;
      const mDisp = computeDisproportionality(mShare, mExpected);
      const mScore = mBaseline && mBaseline.sample_count >= 10 ? computeFuckScore(mZ, mDisp) : 0;
      return {
        model: m.slug,
        display_name: m.display_name,
        provider: m.provider,
        current_fucks: mFucks,
        fuck_score: mScore,
        status: scoreToStatus(mScore),
        z_score: Math.round(mZ * 100) / 100,
      };
    });

  const response: FuckResponse = {
    ok: true,
    model,
    display_name: modelInfo.display_name,
    current_fucks: currentFucks,
    baseline_mean: Math.round(baselineMean * 10) / 10,
    z_score: Math.round(zScore * 100) / 100,
    current_share: Math.round(currentShare * 1000) / 1000,
    expected_share: Math.round(expectedShare * 1000) / 1000,
    disproportionality: Math.round(disproportionality * 100) / 100,
    fuck_score: fuckScore,
    status,
    other_models: otherModels,
  };

  return c.json(response, 201);
}
