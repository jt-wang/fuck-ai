import type { ModelStatus, FuckStatus } from '../types';
import type { BaselineTiers } from './baseline-resolver';
import {
  resolveBaseline,
  computeZScore,
  computeDisproportionality,
  computeFuckScore,
  scoreToStatus,
} from './scoring';

interface ScoreResult {
  z_score: number;
  disproportionality: number;
  fuck_score: number;
  status: FuckStatus;
  baseline_mean: number | null;
  confidence: number;
}

/**
 * Compute the full score for a single model given its current data.
 * Encapsulates the z-score → disproportionality → combined score pipeline.
 */
export function scoreModel(
  currentFucks: number,
  totalFucks: number,
  baselines: BaselineTiers,
  expectedShare: number,
): ScoreResult {
  const resolved = resolveBaseline(baselines.slot, baselines.hour, baselines.aggregate);

  if (!resolved) {
    return {
      z_score: 0,
      disproportionality: 0,
      fuck_score: 0,
      status: 'unknown',
      baseline_mean: null,
      confidence: 0,
    };
  }

  const z = computeZScore(currentFucks, resolved.mean, resolved.std);
  const share = totalFucks > 0 ? currentFucks / totalFucks : 0;
  const disp = computeDisproportionality(share, expectedShare);
  const score = computeFuckScore(z, disp, resolved.confidence);

  return {
    z_score: Math.round(z * 100) / 100,
    disproportionality: Math.round(disp * 100) / 100,
    fuck_score: score,
    status: scoreToStatus(score),
    baseline_mean: Math.round(resolved.mean * 10) / 10,
    confidence: resolved.confidence,
  };
}

/**
 * Score all models in a batch. Used by status-all and the "other models" section.
 */
export function scoreAllModels(
  models: { slug: string; display_name: string; provider: string }[],
  fuckCountMap: Map<string, number>,
  totalFucks: number,
  baselinesMap: Map<string, BaselineTiers>,
  shareMap: Map<string, number>,
): ModelStatus[] {
  return models.map((m) => {
    const fucks = fuckCountMap.get(m.slug) || 0;
    const baselines = baselinesMap.get(m.slug) || { slot: null, hour: null, aggregate: null };
    const expected = shareMap.get(m.slug) || 0;
    const result = scoreModel(fucks, totalFucks, baselines, expected);

    return {
      model: m.slug,
      display_name: m.display_name,
      provider: m.provider,
      current_fucks: fucks,
      fuck_score: result.fuck_score,
      status: result.status,
      z_score: result.z_score,
    };
  });
}
