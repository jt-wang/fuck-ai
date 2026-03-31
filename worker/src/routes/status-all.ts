import type { Context } from 'hono';
import type { Env } from '../types';
import { computeHourBucket } from '../lib/baseline';
import { loadAllModelBaselines } from '../lib/baseline-resolver';
import { scoreAllModels } from '../lib/model-scorer';

export async function statusAllRoute(c: Context<{ Bindings: Env }>) {
  const now = new Date();
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(now);

  const [allModels, fuckCounts, baselinesMap, shares] = await Promise.all([
    c.env.DB.prepare(
      'SELECT slug, display_name, provider, sort_order FROM models ORDER BY sort_order',
    ).all<{ slug: string; display_name: string; provider: string; sort_order: number }>(),

    c.env.DB.prepare(
      'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? GROUP BY model',
    ).bind(hour_bucket).all<{ model: string; fuck_count: number }>(),

    loadAllModelBaselines(c.env.DB, day_of_week, hour_of_day),

    c.env.DB.prepare(
      'SELECT model, expected_share FROM model_shares',
    ).all<{ model: string; expected_share: number }>(),
  ]);

  const totalFucks = fuckCounts.results.reduce((sum, r) => sum + r.fuck_count, 0);
  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));
  const shareMap = new Map(shares.results.map((s) => [s.model, s.expected_share]));

  const models = scoreAllModels(allModels.results, countMap, totalFucks, baselinesMap, shareMap);

  return c.json({ hour_bucket, models });
}
