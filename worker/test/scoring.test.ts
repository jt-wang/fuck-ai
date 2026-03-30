import { describe, it, expect } from 'vitest';
import {
  computeZScore,
  computeDisproportionality,
  computeFuckScore,
  zScoreToScore,
  disproportionalityToScore,
  scoreToStatus,
} from '../src/lib/scoring';
import type { FuckStatus } from '../src/types';

describe('computeZScore', () => {
  it('returns 0 when current equals baseline mean', () => {
    expect(computeZScore(30, 30, 10)).toBe(0);
  });

  it('returns positive z when current exceeds baseline', () => {
    // 50 fucks, baseline mean 30, std 10 → z = 2.0
    expect(computeZScore(50, 30, 10)).toBe(2);
  });

  it('returns negative z when current is below baseline', () => {
    // 10 fucks, baseline mean 30, std 10 → z = -2.0
    expect(computeZScore(10, 30, 10)).toBe(-2);
  });

  it('handles zero std by using mean as std (avoid division by zero)', () => {
    // std=0 → fallback to max(mean*0.1, 1)
    const z = computeZScore(40, 30, 0);
    expect(z).toBeGreaterThan(0);
    expect(Number.isFinite(z)).toBe(true);
  });

  it('handles zero baseline (cold start)', () => {
    const z = computeZScore(5, 0, 0);
    expect(Number.isFinite(z)).toBe(true);
  });
});

describe('computeDisproportionality', () => {
  it('returns 1.0 when share equals expected share', () => {
    expect(computeDisproportionality(0.4, 0.4)).toBe(1.0);
  });

  it('returns >1 when model gets more complaints than expected', () => {
    // 60% share vs 40% expected → ~1.5
    expect(computeDisproportionality(0.6, 0.4)).toBeCloseTo(1.5);
  });

  it('returns <1 when model gets fewer complaints than expected', () => {
    // 20% share vs 40% expected → 0.5
    expect(computeDisproportionality(0.2, 0.4)).toBe(0.5);
  });

  it('handles zero expected share gracefully', () => {
    const d = computeDisproportionality(0.1, 0);
    expect(Number.isFinite(d)).toBe(true);
  });

  it('handles zero current share', () => {
    expect(computeDisproportionality(0, 0.4)).toBe(0);
  });
});

describe('zScoreToScore', () => {
  it('maps very negative z (quiet) to 5', () => {
    expect(zScoreToScore(-2)).toBe(5);
  });

  it('maps slightly negative z to 4', () => {
    expect(zScoreToScore(-0.5)).toBe(4);
  });

  it('maps near-zero z (below 0.5 threshold) to 4', () => {
    // z=0.3 is within (-1.0, 0.5] → score 4 (smart range)
    expect(zScoreToScore(0.3)).toBe(4);
  });

  it('maps moderately positive z to 2', () => {
    expect(zScoreToScore(1.8)).toBe(2);
  });

  it('maps highly positive z (lots of fucks) to 1', () => {
    expect(zScoreToScore(3.0)).toBe(1);
  });
});

describe('disproportionalityToScore', () => {
  it('maps low disproportionality (<0.5) to 5', () => {
    expect(disproportionalityToScore(0.3)).toBe(5);
  });

  it('maps normal disproportionality (~1.0) to 3', () => {
    expect(disproportionalityToScore(1.0)).toBe(3);
  });

  it('maps high disproportionality (>1.5) to 1', () => {
    expect(disproportionalityToScore(2.0)).toBe(1);
  });
});

describe('computeFuckScore', () => {
  it('combines z-score and disproportionality with weights 0.6/0.4', () => {
    // z-score maps to 1, disproportionality maps to 1 → combined = 1
    const score = computeFuckScore(3.0, 2.0);
    expect(score).toBe(1);
  });

  it('returns 4 when both metrics are calm', () => {
    // z=0.3 → score 4, d=1.0 → score 3, combined = 0.6*4 + 0.4*3 = 3.6 → round 4
    const score = computeFuckScore(0.3, 1.0);
    expect(score).toBe(4);
  });

  it('returns 5 when both metrics indicate quiet/good', () => {
    const score = computeFuckScore(-2.0, 0.3);
    expect(score).toBe(5);
  });

  it('returns intermediate score when metrics disagree', () => {
    // z says dumb (score 1), PRR says fine (score 5)
    // 0.6*1 + 0.4*5 = 2.6 → round to 3
    const score = computeFuckScore(3.0, 0.3);
    expect(score).toBeGreaterThanOrEqual(2);
    expect(score).toBeLessThanOrEqual(4);
  });

  it('returns integer between 1 and 5', () => {
    for (const z of [-3, -1, 0, 1, 3]) {
      for (const d of [0.2, 0.8, 1.0, 1.5, 2.5]) {
        const score = computeFuckScore(z, d);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
        expect(Number.isInteger(score)).toBe(true);
      }
    }
  });
});

describe('scoreToStatus', () => {
  it('maps 5 to genius', () => {
    expect(scoreToStatus(5)).toBe('genius');
  });
  it('maps 4 to smart', () => {
    expect(scoreToStatus(4)).toBe('smart');
  });
  it('maps 3 to normal', () => {
    expect(scoreToStatus(3)).toBe('normal');
  });
  it('maps 2 to dumb', () => {
    expect(scoreToStatus(2)).toBe('dumb');
  });
  it('maps 1 to braindead', () => {
    expect(scoreToStatus(1)).toBe('braindead');
  });
  it('maps 0 to unknown', () => {
    expect(scoreToStatus(0)).toBe('unknown');
  });
});
