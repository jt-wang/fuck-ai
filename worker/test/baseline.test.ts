import { describe, it, expect } from 'vitest';
import { updateEWMA, computeHourBucket, adaptiveAlpha } from '../src/lib/baseline';

describe('updateEWMA', () => {
  const alpha = 0.3; // smoothing factor

  it('initializes from first observation', () => {
    const result = updateEWMA(0, 0, 0, 25, alpha);
    expect(result.mean).toBe(25);
    expect(result.std).toBeGreaterThan(0); // default initial std
    expect(result.count).toBe(1);
  });

  it('moves mean toward new observation', () => {
    // old mean=30, new observation=50, alpha=0.3
    // new mean = 0.3*50 + 0.7*30 = 15 + 21 = 36
    const result = updateEWMA(30, 10, 5, 50, alpha);
    expect(result.mean).toBeCloseTo(36, 1);
  });

  it('updates std using EWMA of squared differences', () => {
    const result = updateEWMA(30, 10, 5, 50, alpha);
    expect(result.std).toBeGreaterThan(0);
    expect(Number.isFinite(result.std)).toBe(true);
  });

  it('increments count', () => {
    const result = updateEWMA(30, 10, 5, 50, alpha);
    expect(result.count).toBe(6);
  });

  it('converges with repeated same observation', () => {
    let mean = 0, std = 1, count = 0;
    for (let i = 0; i < 100; i++) {
      const r = updateEWMA(mean, std, count, 42, alpha);
      mean = r.mean;
      std = r.std;
      count = r.count;
    }
    expect(mean).toBeCloseTo(42, 0);
    expect(std).toBeLessThan(1); // std should shrink
  });
});

describe('adaptiveAlpha', () => {
  it('returns high alpha for first sample (responsive)', () => {
    const alpha = adaptiveAlpha(0);
    expect(alpha).toBe(0.5);
  });

  it('returns moderate alpha for early samples', () => {
    const alpha = adaptiveAlpha(4);
    expect(alpha).toBeCloseTo(0.25, 1);
  });

  it('returns lower alpha as samples increase', () => {
    const early = adaptiveAlpha(1);
    const mid = adaptiveAlpha(10);
    const late = adaptiveAlpha(25);
    expect(early).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(late);
  });

  it('never goes below 0.1 floor', () => {
    expect(adaptiveAlpha(100)).toBe(0.1);
    expect(adaptiveAlpha(1000)).toBe(0.1);
  });

  it('reaches floor around 25 samples', () => {
    const alpha = adaptiveAlpha(25);
    expect(alpha).toBe(0.1);
  });

  it('always returns a value between 0.1 and 0.5', () => {
    for (const count of [0, 1, 2, 5, 10, 20, 50, 100]) {
      const alpha = adaptiveAlpha(count);
      expect(alpha).toBeGreaterThanOrEqual(0.1);
      expect(alpha).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('computeHourBucket', () => {
  it('truncates to the hour', () => {
    const date = new Date('2026-03-30T14:37:22Z');
    const bucket = computeHourBucket(date);
    expect(bucket.hour_bucket).toBe('2026-03-30T14:00:00Z');
    expect(bucket.hour_of_day).toBe(14);
    expect(bucket.day_of_week).toBe(1); // Monday
  });

  it('handles midnight', () => {
    const date = new Date('2026-03-30T00:05:00Z');
    const bucket = computeHourBucket(date);
    expect(bucket.hour_bucket).toBe('2026-03-30T00:00:00Z');
    expect(bucket.hour_of_day).toBe(0);
  });

  it('handles end of day', () => {
    const date = new Date('2026-03-30T23:59:59Z');
    const bucket = computeHourBucket(date);
    expect(bucket.hour_bucket).toBe('2026-03-30T23:00:00Z');
    expect(bucket.hour_of_day).toBe(23);
  });
});
