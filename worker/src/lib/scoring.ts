import type { FuckStatus } from '../types';

/**
 * Minimum data thresholds per baseline tier.
 * Kept deliberately low — the confidence system handles quality scaling.
 */
const MIN_SLOT_SAMPLES = 1;       // 1 observation of this exact (day, hour) slot
const MIN_HOUR_SAMPLES = 3;       // 3 observations across days for this hour
const MIN_AGGREGATE_SAMPLES = 5;  // 5 observations across all slots

/**
 * Effective samples needed for full scoring confidence.
 * Below this, scores blend toward neutral (3) to avoid volatile early results.
 */
const FULL_CONFIDENCE_SAMPLES = 10;

/** Confidence multipliers — slot-specific data is worth more per sample. */
const SLOT_CONFIDENCE_WEIGHT = 3;
const HOUR_CONFIDENCE_WEIGHT = 1.5;
const AGGREGATE_CONFIDENCE_WEIGHT = 0.5;

const NEUTRAL_SCORE = 3;

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

export interface BaselineTier {
  mean: number;
  std: number;
  samples: number;
}

export interface ResolvedBaseline {
  mean: number;
  std: number;
  confidence: number;
}

/**
 * Three-tier baseline resolution with confidence scoring.
 *
 * Tier 1 (best):  Exact (model, day_of_week, hour_of_day) slot — updates 1x/week
 * Tier 2 (mid):   Same hour_of_day across all days — updates 1x/day
 * Tier 3 (rough): All slots for the model — updates 24x/day
 *
 * Confidence scales with data quality: slot-specific samples are weighted higher
 * because they're more relevant than broad averages.
 */
export function resolveBaseline(
  slot: BaselineTier | null,
  hour: BaselineTier | null,
  aggregate: BaselineTier | null,
): ResolvedBaseline | null {
  if (slot && slot.samples >= MIN_SLOT_SAMPLES) {
    const confidence = Math.min(1, (slot.samples * SLOT_CONFIDENCE_WEIGHT) / FULL_CONFIDENCE_SAMPLES);
    return { mean: slot.mean, std: slot.std, confidence };
  }
  if (hour && hour.samples >= MIN_HOUR_SAMPLES) {
    const confidence = Math.min(1, (hour.samples * HOUR_CONFIDENCE_WEIGHT) / FULL_CONFIDENCE_SAMPLES);
    return { mean: hour.mean, std: hour.std, confidence };
  }
  if (aggregate && aggregate.samples >= MIN_AGGREGATE_SAMPLES) {
    const confidence = Math.min(1, (aggregate.samples * AGGREGATE_CONFIDENCE_WEIGHT) / FULL_CONFIDENCE_SAMPLES);
    return { mean: aggregate.mean, std: aggregate.std, confidence };
  }
  return null;
}

/**
 * Combined fuck score: weighted average of both layers, blended toward
 * neutral (3) based on confidence. Early scores stay close to "normal";
 * as data accumulates, scores swing freely.
 *
 * Layer 1 (self-referencing z-score): weight 0.6
 * Layer 2 (cross-model PRR): weight 0.4
 */
export function computeFuckScore(zScore: number, disproportionality: number, confidence: number = 1): number {
  const s1 = zScoreToScore(zScore);
  const s2 = disproportionalityToScore(disproportionality);
  const raw = 0.6 * s1 + 0.4 * s2;
  const adjusted = NEUTRAL_SCORE + (raw - NEUTRAL_SCORE) * confidence;
  return Math.round(Math.max(1, Math.min(5, adjusted)) * 10) / 10;
}

export function scoreToStatus(score: number): FuckStatus {
  if (score <= 0) return 'unknown';
  if (score < 1.5) return 'braindead';
  if (score < 2.5) return 'dumb';
  if (score < 3.5) return 'normal';
  if (score < 4.5) return 'smart';
  return 'genius';
}
