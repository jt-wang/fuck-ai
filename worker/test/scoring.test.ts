import { describe, it, expect } from 'vitest';
import {
  computeZScore,
  computeDisproportionality,
  computeFuckScore,
  zScoreToScore,
  disproportionalityToScore,
  scoreToStatus,
  resolveBaseline,
} from '../src/lib/scoring';
import type { BaselineTier } from '../src/lib/scoring';
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
    // z-score maps to 1, disproportionality maps to 1 → combined = 1.0
    const score = computeFuckScore(3.0, 2.0);
    expect(score).toBe(1);
  });

  it('returns continuous score when metrics are calm', () => {
    // z=0.3 → score 4, d=1.0 → score 3, combined = 0.6*4 + 0.4*3 = 3.6
    const score = computeFuckScore(0.3, 1.0);
    expect(score).toBe(3.6);
  });

  it('returns 5 when both metrics indicate quiet/good', () => {
    const score = computeFuckScore(-2.0, 0.3);
    expect(score).toBe(5);
  });

  it('returns intermediate score when metrics disagree', () => {
    // z says braindead (score 1), PRR says genius (score 5)
    // 0.6*1 + 0.4*5 = 2.6
    const score = computeFuckScore(3.0, 0.3);
    expect(score).toBe(2.6);
  });

  it('returns value between 1 and 5 with one decimal', () => {
    for (const z of [-3, -1, 0, 1, 3]) {
      for (const d of [0.2, 0.8, 1.0, 1.5, 2.5]) {
        const score = computeFuckScore(z, d);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
        // One decimal place: score * 10 should be an integer
        expect(Number.isInteger(score * 10)).toBe(true);
      }
    }
  });

  describe('confidence weighting', () => {
    it('blends toward neutral (3) at low confidence', () => {
      // raw = 0.6*1 + 0.4*1 = 1.0
      // With confidence=0.25: 3 + (1-3)*0.25 = 2.5
      const score = computeFuckScore(3.0, 2.0, 0.25);
      expect(score).toBe(2.5);
    });

    it('returns full score at confidence=1', () => {
      const withConfidence = computeFuckScore(3.0, 2.0, 1.0);
      const withDefault = computeFuckScore(3.0, 2.0);
      expect(withConfidence).toBe(withDefault);
    });

    it('returns neutral at confidence=0', () => {
      const score = computeFuckScore(3.0, 2.0, 0);
      expect(score).toBe(3); // neutral
    });

    it('scores become more extreme as confidence increases', () => {
      // braindead signal (z=3, d=2) at increasing confidence levels
      const scores = [0.1, 0.3, 0.5, 0.7, 1.0].map(c => computeFuckScore(3.0, 2.0, c));
      // Should be non-increasing (moving from neutral toward 1)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('genius signal becomes more extreme with confidence', () => {
      // genius signal (z=-2, d=0.3) at increasing confidence levels
      const scores = [0.1, 0.3, 0.5, 0.7, 1.0].map(c => computeFuckScore(-2.0, 0.3, c));
      // Should be non-decreasing (moving from neutral toward 5)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('always returns value between 1 and 5 with one decimal regardless of confidence', () => {
      for (const conf of [0, 0.1, 0.25, 0.5, 0.75, 1.0]) {
        for (const z of [-3, 0, 3]) {
          for (const d of [0.2, 1.0, 2.5]) {
            const score = computeFuckScore(z, d, conf);
            expect(score).toBeGreaterThanOrEqual(1);
            expect(score).toBeLessThanOrEqual(5);
            expect(Number.isInteger(score * 10)).toBe(true);
          }
        }
      }
    });
  });
});

describe('resolveBaseline', () => {
  const makeSlot = (samples: number): BaselineTier => ({ mean: 20, std: 5, samples });
  const makeHour = (samples: number): BaselineTier => ({ mean: 15, std: 6, samples });
  const makeAgg = (samples: number): BaselineTier => ({ mean: 10, std: 8, samples });

  describe('tier selection', () => {
    it('returns null when all tiers are null', () => {
      expect(resolveBaseline(null, null, null)).toBeNull();
    });

    it('returns null when all tiers have insufficient data', () => {
      expect(resolveBaseline(makeSlot(0), makeHour(1), makeAgg(2))).toBeNull();
    });

    it('prefers slot-specific baseline when available (tier 1)', () => {
      const result = resolveBaseline(makeSlot(1), makeHour(5), makeAgg(20));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(20); // slot mean
    });

    it('falls back to hour-only when slot has no data (tier 2)', () => {
      const result = resolveBaseline(null, makeHour(5), makeAgg(20));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(15); // hour mean
    });

    it('falls back to aggregate when slot and hour have no data (tier 3)', () => {
      const result = resolveBaseline(null, null, makeAgg(10));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(10); // aggregate mean
    });

    it('falls back to hour when slot has 0 samples', () => {
      const result = resolveBaseline(makeSlot(0), makeHour(3), makeAgg(10));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(15); // hour mean
    });

    it('falls back to aggregate when hour has insufficient samples', () => {
      const result = resolveBaseline(makeSlot(0), makeHour(2), makeAgg(10));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(10); // aggregate mean
    });
  });

  describe('confidence scaling', () => {
    it('returns higher confidence for slot-specific with more samples', () => {
      const low = resolveBaseline(makeSlot(1), null, null)!;
      const high = resolveBaseline(makeSlot(5), null, null)!;
      expect(high.confidence).toBeGreaterThan(low.confidence);
    });

    it('slot-specific data has higher confidence per sample than aggregate', () => {
      // Slot with 2 samples should have higher confidence than aggregate with 2*3=6 samples
      // because slot data is more relevant (exact time match)
      const slot = resolveBaseline(makeSlot(2), null, null)!;
      const agg = resolveBaseline(null, null, makeAgg(6))!;
      expect(slot.confidence).toBeGreaterThan(agg.confidence);
    });

    it('confidence is capped at 1.0', () => {
      const result = resolveBaseline(makeSlot(100), null, null)!;
      expect(result.confidence).toBe(1);
    });

    it('confidence is always between 0 and 1', () => {
      for (const samples of [1, 2, 5, 10, 50, 100]) {
        const slot = resolveBaseline(makeSlot(samples), null, null);
        if (slot) {
          expect(slot.confidence).toBeGreaterThan(0);
          expect(slot.confidence).toBeLessThanOrEqual(1);
        }
        const agg = resolveBaseline(null, null, makeAgg(samples + 4));
        if (agg) {
          expect(agg.confidence).toBeGreaterThan(0);
          expect(agg.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('auto-improvement over time', () => {
    it('after ~5 hours (aggregate only): shows score with low confidence', () => {
      // 5 cron runs, 5 different slots, each with 1 sample → total=5
      const result = resolveBaseline(null, null, makeAgg(5));
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeLessThan(0.5);
    });

    it('after ~3 days (hour tier available): uses hour-specific data', () => {
      // 3 days of data for this hour → hour has 3 samples
      const result = resolveBaseline(null, makeHour(3), makeAgg(72));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(15); // uses hour tier (more precise than aggregate)
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it('hour tier with many samples has higher confidence than with few', () => {
      const few = resolveBaseline(null, makeHour(3), null)!;
      const many = resolveBaseline(null, makeHour(10), null)!;
      expect(many.confidence).toBeGreaterThan(few.confidence);
    });

    it('after 1 week (slot available): uses most precise data', () => {
      const result = resolveBaseline(makeSlot(1), makeHour(7), makeAgg(168));
      expect(result).not.toBeNull();
      expect(result!.mean).toBe(20); // slot mean — most precise
    });

    it('after 5 weeks (mature slot): near-full confidence', () => {
      const result = resolveBaseline(makeSlot(5), makeHour(35), makeAgg(840));
      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});

describe('scoreToStatus', () => {
  it('maps >= 4.5 to genius', () => {
    expect(scoreToStatus(5)).toBe('genius');
    expect(scoreToStatus(4.5)).toBe('genius');
  });
  it('maps 3.5–4.4 to smart', () => {
    expect(scoreToStatus(4)).toBe('smart');
    expect(scoreToStatus(3.5)).toBe('smart');
    expect(scoreToStatus(4.4)).toBe('smart');
  });
  it('maps 2.5–3.4 to normal', () => {
    expect(scoreToStatus(3)).toBe('normal');
    expect(scoreToStatus(2.5)).toBe('normal');
    expect(scoreToStatus(3.4)).toBe('normal');
  });
  it('maps 1.5–2.4 to dumb', () => {
    expect(scoreToStatus(2)).toBe('dumb');
    expect(scoreToStatus(1.5)).toBe('dumb');
    expect(scoreToStatus(2.4)).toBe('dumb');
  });
  it('maps 1–1.4 to braindead', () => {
    expect(scoreToStatus(1)).toBe('braindead');
    expect(scoreToStatus(1.4)).toBe('braindead');
  });
  it('maps 0 to unknown', () => {
    expect(scoreToStatus(0)).toBe('unknown');
  });
});
