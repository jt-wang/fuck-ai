import type { Context } from 'hono';
import type { Env } from '../types';
import { hashIP } from '../lib/hash';
import { computeHourBucket } from '../lib/baseline';
import { computeZScore, computeDisproportionality, computeFuckScore, scoreToStatus, resolveBaseline } from '../lib/scoring';
import { formatFuckText } from '../lib/format';

export async function fuckTextRoute(c: Context<{ Bindings: Env }>) {
  const model = c.req.param('model');

  const modelInfo = await c.env.DB.prepare(
    'SELECT slug, display_name, provider FROM models WHERE slug = ?',
  )
    .bind(model)
    .first<{ slug: string; display_name: string; provider: string }>();

  if (!modelInfo) {
    return c.text(`Unknown model: ${model}`, 400);
  }

  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '0.0.0.0';
  const ipHash = await hashIP(ip);

  // Rate limit
  const rlKey = `rl:${ipHash}:${hour_bucket}`;
  const rlCount = parseInt((await c.env.RATE_LIMIT.get(rlKey)) || '0', 10);
  if (rlCount >= 30) {
    return c.text('Rate limited: max 30 fucks per hour', 429);
  }
  await c.env.RATE_LIMIT.put(rlKey, String(rlCount + 1), { expirationTtl: 3600 });

  // Insert
  await c.env.DB.prepare(
    `INSERT INTO fucks (model, ip_hash, hour_bucket, day_of_week, hour_of_day)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ip_hash, model, hour_bucket) DO UPDATE SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  )
    .bind(model, ipHash, hour_bucket, day_of_week, hour_of_day)
    .run();

  // Current counts
  const currentRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
  ).bind(model, hour_bucket).first<{ count: number }>();
  const currentFucks = currentRow?.count || 0;

  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
  ).bind(hour_bucket).first<{ count: number }>();
  const totalFucks = totalRow?.count || 1;

  // Per-slot baseline
  const baseline = await c.env.DB.prepare(
    'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
  ).bind(model, day_of_week, hour_of_day).first<{ ewma_mean: number; ewma_std: number; sample_count: number }>();

  // Aggregate baseline (fallback)
  const aggregate = await c.env.DB.prepare(
    'SELECT AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines WHERE model = ?',
  ).bind(model).first<{ avg_mean: number; avg_std: number; total_samples: number }>();

  const modelShare = await c.env.DB.prepare(
    'SELECT expected_share FROM model_shares WHERE model = ?',
  ).bind(model).first<{ expected_share: number }>();

  const resolved = resolveBaseline(baseline, aggregate);
  const z = resolved ? computeZScore(currentFucks, resolved.mean, resolved.std) : 0;
  const currentShare = totalFucks > 0 ? currentFucks / totalFucks : 0;
  const disp = computeDisproportionality(currentShare, modelShare?.expected_share || 0);
  const score = resolved ? computeFuckScore(z, disp) : 0;

  // Other models
  const allModels = await c.env.DB.prepare(
    'SELECT slug, display_name FROM models WHERE slug != ? ORDER BY sort_order',
  ).bind(model).all<{ slug: string; display_name: string }>();

  const fuckCounts = await c.env.DB.prepare(
    'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? AND model != ? GROUP BY model',
  ).bind(hour_bucket, model).all<{ model: string; fuck_count: number }>();

  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));

  const otherModels = allModels.results
    .filter((m) => countMap.has(m.slug))
    .map((m) => ({
      display_name: m.display_name,
      current_fucks: countMap.get(m.slug) || 0,
      fuck_score: 0, // simplified: skip scoring for others in text mode
      status: 'unknown',
    }));

  const text = formatFuckText({
    display_name: modelInfo.display_name,
    current_fucks: currentFucks,
    baseline_mean: resolved ? Math.round(resolved.mean * 10) / 10 : 0,
    z_score: Math.round(z * 100) / 100,
    fuck_score: score,
    status: scoreToStatus(score),
    other_models: otherModels,
  });

  return c.text(text);
}
