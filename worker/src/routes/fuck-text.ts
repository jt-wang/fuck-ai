import type { Context } from 'hono';
import type { Env } from '../types';
import { hashIP } from '../lib/hash';
import { computeHourBucket } from '../lib/baseline';
import { loadModelBaselines } from '../lib/baseline-resolver';
import { scoreModel } from '../lib/model-scorer';
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

  // Rate limit
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '0.0.0.0';
  const ipHash = await hashIP(ip);
  const rlKey = `rl:${ipHash}:${hour_bucket}`;
  const rlCount = parseInt((await c.env.RATE_LIMIT.get(rlKey)) || '0', 10);
  if (rlCount >= 30) {
    return c.text('Rate limited: max 30 fucks per hour', 429);
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

  // Load scoring data
  const [currentRow, totalRow, baselines, modelShare] = await Promise.all([
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
  const result = scoreModel(currentFucks, totalFucks, baselines, modelShare?.expected_share || 0);

  // Other models (simplified for text mode)
  const [allModels, fuckCounts] = await Promise.all([
    c.env.DB.prepare(
      'SELECT slug, display_name FROM models WHERE slug != ? ORDER BY sort_order',
    ).bind(model).all<{ slug: string; display_name: string }>(),

    c.env.DB.prepare(
      'SELECT model, COUNT(*) as fuck_count FROM fucks WHERE hour_bucket = ? AND model != ? GROUP BY model',
    ).bind(hour_bucket, model).all<{ model: string; fuck_count: number }>(),
  ]);

  const countMap = new Map(fuckCounts.results.map((r) => [r.model, r.fuck_count]));
  const otherModels = allModels.results
    .filter((m) => countMap.has(m.slug))
    .map((m) => ({
      display_name: m.display_name,
      current_fucks: countMap.get(m.slug) || 0,
      fuck_score: 0,
      status: 'unknown',
    }));

  const text = formatFuckText({
    display_name: modelInfo.display_name,
    current_fucks: currentFucks,
    baseline_mean: result.baseline_mean ?? 0,
    z_score: result.z_score,
    fuck_score: result.fuck_score,
    status: result.status,
    other_models: otherModels,
  });

  return c.text(text);
}
