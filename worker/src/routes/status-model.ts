import type { Context } from 'hono';
import type { Env } from '../types';
import { computeHourBucket, fillHourlyGaps } from '../lib/baseline';
import { computeZScore, computeDisproportionality, computeFuckScore, scoreToStatus } from '../lib/scoring';

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

  // Baseline & share
  const baseline = await c.env.DB.prepare(
    'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
  )
    .bind(model, day_of_week, hour_of_day)
    .first<{ ewma_mean: number; ewma_std: number; sample_count: number }>();

  const share = await c.env.DB.prepare(
    'SELECT expected_share FROM model_shares WHERE model = ?',
  )
    .bind(model)
    .first<{ expected_share: number }>();

  const z = baseline ? computeZScore(currentFucks, baseline.ewma_mean, baseline.ewma_std) : 0;
  const currentShare = totalFucks > 0 ? currentFucks / totalFucks : 0;
  const disp = computeDisproportionality(currentShare, share?.expected_share || 0);
  const score = baseline && baseline.sample_count >= 10 ? computeFuckScore(z, disp) : 0;

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
    baseline_mean: baseline ? Math.round(baseline.ewma_mean * 10) / 10 : null,
    baseline_std: baseline ? Math.round(baseline.ewma_std * 10) / 10 : null,
    z_score: Math.round(z * 100) / 100,
    fuck_score: score,
    status: scoreToStatus(score),
    hours: fillHourlyGaps(hourly.results, now),
  });
}
