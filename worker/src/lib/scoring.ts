import type { FuckStatus } from '../types';

/**
 * Minimum number of EWMA samples required before a per-slot baseline is trusted.
 * Each (model, day_of_week, hour_of_day) slot is updated once per week,
 * so a value of 3 means ~3 weeks of data before the slot-specific baseline is used.
 * Below this threshold, we fall back to the model's aggregate baseline.
 */
export const MIN_BASELINE_SAMPLES = 3;

/**
 * Minimum total samples across ALL slots before we show any score.
 * With 24 slots updated per day, this is reached after ~1 day of data.
 */
export const MIN_TOTAL_SAMPLES_FOR_FALLBACK = 20;

/**
 * Layer 1: Downdetector method — z-score against own baseline.
 * Positive z = more fucks than usual = model is dumber.
 */
export function computeZScore(current: number, baselineMean: number, baselineStd: number): number {
  const effectiveStd = baselineStd > 0 ? baselineStd : Math.max(baselineMean * 0.1, 1);
  return (current - baselineMean) / effectiveStd;
}

/**
 * Layer 2: FDA PRR method — disproportionality of complaint share.
 * >1 = model gets more than expected share of complaints.
 */
export function computeDisproportionality(currentShare: number, expectedShare: number): number {
  if (currentShare === 0) return 0;
  if (expectedShare <= 0) return currentShare > 0 ? 2.0 : 1.0;
  return currentShare / expectedShare;
}

/**
 * Map z-score to 1-5 score (inverted: high z = low score).
 *   z <= -1.0  → 5 (genius: unusually quiet)
 *  -1.0 < z <= 0.5  → 4 (smart)
 *   0.5 < z <= 1.5  → 3 (normal / slightly elevated)
 *   1.5 < z <= 2.5  → 2 (dumb)
 *   z > 2.5         → 1 (braindead)
 */
export function zScoreToScore(z: number): number {
  if (z <= -1.0) return 5;
  if (z <= 0.5) return 4;
  if (z <= 1.5) return 3;
  if (z <= 2.5) return 2;
  return 1;
}

/**
 * Map disproportionality ratio to 1-5 score.
 *   d <= 0.5  → 5 (getting fewer complaints than expected)
 *   d <= 0.8  → 4
 *   d <= 1.2  → 3 (normal share)
 *   d <= 1.5  → 2
 *   d > 1.5   → 1 (getting way more than expected)
 */
export function disproportionalityToScore(d: number): number {
  if (d <= 0.5) return 5;
  if (d <= 0.8) return 4;
  if (d <= 1.2) return 3;
  if (d <= 1.5) return 2;
  return 1;
}

/**
 * Combined fuck score: weighted average of both layers.
 * Layer 1 (self-referencing z-score): weight 0.6
 * Layer 2 (cross-model PRR): weight 0.4
 */
export function computeFuckScore(zScore: number, disproportionality: number): number {
  const s1 = zScoreToScore(zScore);
  const s2 = disproportionalityToScore(disproportionality);
  const combined = 0.6 * s1 + 0.4 * s2;
  return Math.max(1, Math.min(5, Math.round(combined)));
}

/**
 * Resolve a baseline for scoring: use the per-slot baseline if it has enough samples,
 * otherwise fall back to the model's aggregate baseline across all time slots.
 * Returns null if there's insufficient data everywhere (truly calibrating).
 */
export function resolveBaseline(
  slotBaseline: { ewma_mean: number; ewma_std: number; sample_count: number } | null,
  aggregateBaseline: { avg_mean: number; avg_std: number; total_samples: number } | null,
): { mean: number; std: number } | null {
  // Prefer slot-specific baseline when it has enough data
  if (slotBaseline && slotBaseline.sample_count >= MIN_BASELINE_SAMPLES) {
    return { mean: slotBaseline.ewma_mean, std: slotBaseline.ewma_std };
  }
  // Fall back to model's aggregate baseline across all slots
  if (aggregateBaseline && aggregateBaseline.total_samples >= MIN_TOTAL_SAMPLES_FOR_FALLBACK) {
    return { mean: aggregateBaseline.avg_mean, std: aggregateBaseline.avg_std };
  }
  return null;
}

export function scoreToStatus(score: number): FuckStatus {
  switch (score) {
    case 5: return 'genius';
    case 4: return 'smart';
    case 3: return 'normal';
    case 2: return 'dumb';
    case 1: return 'braindead';
    default: return 'unknown';
  }
}
