import { describe, it, expect } from 'vitest';
import { fillHourlyGaps } from '../src/lib/baseline';

describe('fillHourlyGaps', () => {
  it('returns 24 entries for a full day', () => {
    const now = new Date('2026-03-30T14:00:00Z');
    const result = fillHourlyGaps([], now);
    expect(result).toHaveLength(24);
  });

  it('fills missing hours with 0', () => {
    const now = new Date('2026-03-30T14:00:00Z');
    const result = fillHourlyGaps([], now);
    expect(result.every((h) => h.fuck_count === 0)).toBe(true);
  });

  it('preserves existing data at the correct hour', () => {
    const now = new Date('2026-03-30T14:00:00Z');
    const sparse = [
      { hour_bucket: '2026-03-30T10:00:00Z', fuck_count: 5 },
      { hour_bucket: '2026-03-30T14:00:00Z', fuck_count: 3 },
    ];
    const result = fillHourlyGaps(sparse, now);
    expect(result).toHaveLength(24);

    const at10 = result.find((h) => h.hour_bucket === '2026-03-30T10:00:00Z');
    expect(at10?.fuck_count).toBe(5);

    const at14 = result.find((h) => h.hour_bucket === '2026-03-30T14:00:00Z');
    expect(at14?.fuck_count).toBe(3);
  });

  it('is sorted ascending by hour_bucket', () => {
    const now = new Date('2026-03-30T14:00:00Z');
    const result = fillHourlyGaps([], now);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].hour_bucket > result[i - 1].hour_bucket).toBe(true);
    }
  });

  it('spans midnight correctly', () => {
    const now = new Date('2026-03-30T03:00:00Z');
    const result = fillHourlyGaps([], now);
    expect(result).toHaveLength(24);
    // First bucket should be 24h ago: 2026-03-29T04:00:00Z
    expect(result[0].hour_bucket).toBe('2026-03-29T04:00:00Z');
    // Last bucket should be now: 2026-03-30T03:00:00Z
    expect(result[23].hour_bucket).toBe('2026-03-30T03:00:00Z');
  });
});
