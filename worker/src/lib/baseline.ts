import type { HourBucket } from '../types';

interface EWMAResult {
  mean: number;
  std: number;
  count: number;
}

const DEFAULT_INITIAL_STD = 5;

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
