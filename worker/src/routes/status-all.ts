import type { Context } from 'hono';
import type { Env, ModelStatus } from '../types';
import { computeHourBucket } from '../lib/baseline';
import { computeZScore, computeDisproportionality, computeFuckScore, scoreToStatus, resolveBaseline } from '../lib/scoring';

export async function statusAllRoute(c: Context<{ Bindings: Env }>) {
  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  // Get all models
  const allModels = await c.env.DB.prepare(
    'SELECT slug, display_name, provider, sort_order FROM models ORDER BY sort_order',
  ).all<{ slug: string; display_name: string; provider: string; sort_order: number }>();

  // Get fuck counts this hour
  const fuckCounts = await c.env.DB.prepare(
    'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? GROUP BY model',
  )
    .bind(hour_bucket)
    .all<{ model: string; fuck_count: number }>();

  const totalFucks = fuckCounts.results.reduce((sum, r) => sum + r.fuck_count, 0);
  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));

  // Get per-slot baselines
  const baselines = await c.env.DB.prepare(
    'SELECT model, ewma_mean, ewma_std, sample_count FROM baselines WHERE day_of_week = ? AND hour_of_day = ?',
  )
    .bind(day_of_week, hour_of_day)
    .all<{ model: string; ewma_mean: number; ewma_std: number; sample_count: number }>();
  const baselineMap = new Map(baselines.results.map((b) => [b.model, b]));

  // Get aggregate baselines (fallback for slots with insufficient data)
  const aggregates = await c.env.DB.prepare(
    'SELECT model, AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines GROUP BY model',
  ).all<{ model: string; avg_mean: number; avg_std: number; total_samples: number }>();
  const aggregateMap = new Map(aggregates.results.map((a) => [a.model, a]));

  // Get shares
  const shares = await c.env.DB.prepare(
    'SELECT model, expected_share FROM model_shares',
  ).all<{ model: string; expected_share: number }>();
  const shareMap = new Map(shares.results.map((s) => [s.model, s.expected_share]));

  const models: ModelStatus[] = allModels.results.map((m) => {
    const fucks = countMap.get(m.slug) || 0;
    const bl = baselineMap.get(m.slug) || null;
    const agg = aggregateMap.get(m.slug) || null;
    const resolved = resolveBaseline(bl, agg);
    const z = resolved ? computeZScore(fucks, resolved.mean, resolved.std) : 0;
    const share = totalFucks > 0 ? fucks / totalFucks : 0;
    const expected = shareMap.get(m.slug) || 0;
    const disp = computeDisproportionality(share, expected);
    const score = resolved ? computeFuckScore(z, disp) : 0;

    return {
      model: m.slug,
      display_name: m.display_name,
      provider: m.provider,
      current_fucks: fucks,
      fuck_score: score,
      status: scoreToStatus(score),
      z_score: Math.round(z * 100) / 100,
    };
  });

  return c.json({ hour_bucket, models });
}
