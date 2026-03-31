import type { Env } from '../types';
import { computeHourBucket, updateEWMA, adaptiveAlpha } from '../lib/baseline';

const SHARE_EWMA_ALPHA = 0.3;

/**
 * Cron job: runs every hour at :00.
 * Updates EWMA baselines for the PREVIOUS hour's data.
 * Also updates model complaint shares.
 */
export async function updateBaselines(env: Env): Promise<void> {
  // We're updating the baseline for the PREVIOUS hour
  const now = new Date();
  const prevHour = new Date(now.getTime() - 60 * 60 * 1000);
  const { hour_bucket, day_of_week, hour_of_day } = computeHourBucket(prevHour);

  // Get all models
  const models = await env.DB.prepare(
    'SELECT slug FROM models',
  ).all<{ slug: string }>();

  // Get total fucks in previous hour (for share calculation)
  const totalRow = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM fucks WHERE hour_bucket = ?',
  )
    .bind(hour_bucket)
    .first<{ count: number }>();
  const totalFucks = totalRow?.count || 0;

  for (const model of models.results) {
    // Count fucks for this model in the previous hour
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM fucks WHERE model = ? AND hour_bucket = ?',
    )
      .bind(model.slug, hour_bucket)
      .first<{ count: number }>();
    const fuckCount = row?.count || 0;

    // Layer 1: Update EWMA baseline for (model, day_of_week, hour_of_day)
    const existing = await env.DB.prepare(
      'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
    )
      .bind(model.slug, day_of_week, hour_of_day)
      .first<{ ewma_mean: number; ewma_std: number; sample_count: number }>();

    const oldMean = existing?.ewma_mean || 0;
    const oldStd = existing?.ewma_std || 0;
    const oldCount = existing?.sample_count || 0;

    const alpha = adaptiveAlpha(oldCount);
    const { mean, std, count } = updateEWMA(oldMean, oldStd, oldCount, fuckCount, alpha);

    await env.DB.prepare(
      `INSERT INTO baselines (model, day_of_week, hour_of_day, ewma_mean, ewma_std, sample_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (model, day_of_week, hour_of_day)
       DO UPDATE SET ewma_mean = ?, ewma_std = ?, sample_count = ?, updated_at = datetime('now')`,
    )
      .bind(model.slug, day_of_week, hour_of_day, mean, std, count, mean, std, count)
      .run();

    // Layer 2: Update model complaint share
    if (totalFucks > 0) {
      const currentShare = fuckCount / totalFucks;
      const existingShare = await env.DB.prepare(
        'SELECT expected_share, total_fucks FROM model_shares WHERE model = ?',
      )
        .bind(model.slug)
        .first<{ expected_share: number; total_fucks: number }>();

      const oldShare = existingShare?.expected_share || 0;
      const oldTotal = existingShare?.total_fucks || 0;
      // EWMA for share as well
      const newShare = oldTotal > 0
        ? SHARE_EWMA_ALPHA * currentShare + (1 - SHARE_EWMA_ALPHA) * oldShare
        : currentShare;

      await env.DB.prepare(
        `INSERT INTO model_shares (model, expected_share, total_fucks, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT (model)
         DO UPDATE SET expected_share = ?, total_fucks = total_fucks + ?, updated_at = datetime('now')`,
      )
        .bind(model.slug, newShare, fuckCount, newShare, fuckCount)
        .run();
    }
  }
}
