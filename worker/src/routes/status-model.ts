import type { Context } from 'hono';
import type { Env } from '../types';
import { computeHourBucket, fillHourlyGaps } from '../lib/baseline';
import { computeZScore, computeDisproportionality, computeFuckScore, scoreToStatus, resolveBaseline } from '../lib/scoring';

export async function statusModelRoute(c: Context<{ Bindings: Env }>) {
  const model = c.req.param('model');

  const modelInfo = await c.env.DB.prepare(
    'SELECT slug, display_name, provider FROM models WHERE slug = ?',
  )
    .bind(model)
    .first<{ slug: string; display_name: string; provider: string }>();

  if (!modelInfo) {
    return c.json({ error: `unknown model: ${model}` }, 404);
  }

  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  // Current hour data
  const currentRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
  )
    .bind(model, hour_bucket)
    .first<{ count: number }>();
  const currentFucks = currentRow?.count || 0;

  const totalRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
  )
    .bind(hour_bucket)
    .first<{ count: number }>();
  const totalFucks = totalRow?.count || 1;

  // Per-slot baseline
  const baseline = await c.env.DB.prepare(
    'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
  )
    .bind(model, day_of_week, hour_of_day)
    .first<{ ewma_mean: number; ewma_std: number; sample_count: number }>();

  // Aggregate baseline (fallback)
  const aggregate = await c.env.DB.prepare(
    'SELECT AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines WHERE model = ?',
  )
    .bind(model)
    .first<{ avg_mean: number; avg_std: number; total_samples: number }>();

  const share = await c.env.DB.prepare(
    'SELECT expected_share FROM model_shares WHERE model = ?',
  )
    .bind(model)
    .first<{ expected_share: number }>();

  const resolved = resolveBaseline(baseline, aggregate);
  const z = resolved ? computeZScore(currentFucks, resolved.mean, resolved.std) : 0;
  const currentShare = totalFucks > 0 ? currentFucks / totalFucks : 0;
  const disp = computeDisproportionality(currentShare, share?.expected_share || 0);
  const score = resolved ? computeFuckScore(z, disp) : 0;

  // 24-hour trend
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoff = computeHourBucket(twentyFourHoursAgo).hour_bucket;

  const hourly = await c.env.DB.prepare(
    'SELECT hour_bucket, COUNT(*) as fuck_count FROM fucks WHERE model = ? AND hour_bucket >= ? GROUP BY hour_bucket ORDER BY hour_bucket ASC',
  )
    .bind(model, cutoff)
    .all<{ hour_bucket: string; fuck_count: number }>();

  return c.json({
    model: modelInfo.slug,
    display_name: modelInfo.display_name,
    provider: modelInfo.provider,
    current_fucks: currentFucks,
    baseline_mean: resolved ? Math.round(resolved.mean * 10) / 10 : null,
    z_score: Math.round(z * 100) / 100,
    fuck_score: score,
    status: scoreToStatus(score),
    hours: fillHourlyGaps(hourly.results, now),
  });
}
