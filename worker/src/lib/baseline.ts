import type { HourBucket } from '../types';

interface EWMAResult {
  mean: number;
  std: number;
  count: number;
}

const DEFAULT_INITIAL_STD = 5;

/**
 * Compute adaptive EWMA alpha based on sample count.
 * Early observations get high alpha (responsive, fast learning).
 * Mature baselines get low alpha (stable, resistant to noise).
 *
 *   count=1  → α=0.50 (responsive)
 *   count=4  → α=0.25
 *   count=10 → α=0.16
 *   count=25 → α=0.10 (stable floor)
 */
export function adaptiveAlpha(sampleCount: number): number {
  return Math.max(0.1, 0.5 / Math.sqrt(Math.max(sampleCount, 1)));
}

/**
 * Update EWMA (Exponentially Weighted Moving Average) with a new observation.
 * Used to maintain the per-(model, day_of_week, hour_of_day) baseline.
 *
 * EWMA adapts to gradual trends (user base growth) while providing a stable
 * baseline. Sudden spikes in fuck rate will be detected as anomalies.
 */
export function updateEWMA(
  oldMean: number,
  oldStd: number,
  oldCount: number,
  newObservation: number,
  alpha: number,
): EWMAResult {
  if (oldCount === 0) {
    return { mean: newObservation, std: DEFAULT_INITIAL_STD, count: 1 };
  }

  const newMean = alpha * newObservation + (1 - alpha) * oldMean;
  const diff = newObservation - oldMean;
  const newVariance = (1 - alpha) * (oldStd * oldStd + alpha * diff * diff);
  const newStd = Math.sqrt(Math.max(newVariance, 0.01));

  return { mean: newMean, std: newStd, count: oldCount + 1 };
}

/**
 * Fill sparse hourly DB results into a full 24-entry array (one per hour),
 * inserting { hour_bucket, fuck_count: 0 } for missing hours.
 */
export function fillHourlyGaps(
  sparse: { hour_bucket: string; fuck_count: number }[],
  now: Date,
): { hour_bucket: string; fuck_count: number }[] {
  const lookup = new Map(sparse.map((h) => [h.hour_bucket, h.fuck_count]));
  const result: { hour_bucket: string; fuck_count: number }[] = [];

  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    const bucket = computeHourBucket(t).hour_bucket;
    result.push({ hour_bucket: bucket, fuck_count: lookup.get(bucket) ?? 0 });
  }

  return result;
}

/**
 * Compute the hour bucket for a given timestamp.
 * Truncates to the hour in UTC.
 */
export function computeHourBucket(date: Date): HourBucket {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');

  return {
    hour_bucket: `${y}-${m}-${d}T${h}:00:00Z`,
    day_of_week: date.getUTCDay(),
    hour_of_day: date.getUTCHours(),
  };
}
