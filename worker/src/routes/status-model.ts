import type { Context } from 'hono';
import type { Env } from '../types';
import { computeHourBucket, fillHourlyGaps } from '../lib/baseline';
import { loadModelBaselines } from '../lib/baseline-resolver';
import { scoreModel } from '../lib/model-scorer';

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

  const [currentRow, totalRow, baselines, share] = await Promise.all([
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
    ).bind(model, hour_bucket).first<{ count: number }>(),

    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
    ).bind(hour_bucket).first<{ count: number }>(),

    loadModelBaselines(c.env.DB, model, day_of_week, hour_of_day),

    c.env.DB.prepare(
      'SELECT expected_share FROM model_shares WHERE model = ?',
    ).bind(model).first<{ expected_share: number }>(),
  ]);

  const currentFucks = currentRow?.count || 0;
  const totalFucks = totalRow?.count || 1;
  const result = scoreModel(currentFucks, totalFucks, baselines, share?.expected_share || 0);

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
    baseline_mean: result.baseline_mean,
    z_score: result.z_score,
    fuck_score: result.fuck_score,
    status: result.status,
    hours: fillHourlyGaps(hourly.results, now),
  });
}
