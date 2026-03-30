import { describe, it, expect } from 'vitest';
import { formatFuckText } from '../src/lib/format';

describe('formatFuckText', () => {
  it('formats calibrating state', () => {
    const text = formatFuckText({
      display_name: 'Claude Opus 4.6',
      current_fucks: 3,
      baseline_mean: 0,
      z_score: 0,
      fuck_score: 0,
      status: 'unknown',
      other_models: [],
    });
    expect(text).toContain('Recorded');
    expect(text).toContain('Claude Opus 4.6');
    expect(text).toContain('calibrating');
    expect(text).toContain('3 fucks/hr');
    expect(text).toContain('fuck-ai.dev');
  });

  it('formats scored state', () => {
    const text = formatFuckText({
      display_name: 'Claude Opus 4.6',
      current_fucks: 47,
      baseline_mean: 30,
      z_score: 1.68,
      fuck_score: 2,
      status: 'dumb',
      other_models: [
        { display_name: 'GPT-4o', current_fucks: 12, fuck_score: 4, status: 'smart' },
        { display_name: 'Gemini 2.5 Pro', current_fucks: 8, fuck_score: 3, status: 'normal' },
      ],
    });
    expect(text).toContain('2/5 (dumb)');
    expect(text).toContain('47 fucks/hr');
    expect(text).toContain('baseline ~30');
    expect(text).toContain('GPT-4o');
  });

  it('adds complaint context for high z-score', () => {
    const text = formatFuckText({
      display_name: 'Claude Opus 4.6',
      current_fucks: 90,
      baseline_mean: 30,
      z_score: 2.8,
      fuck_score: 1,
      status: 'braindead',
      other_models: [],
    });
    expect(text).toContain('more complaints than usual');
  });

  it('limits other models to 5', () => {
    const others = Array.from({ length: 10 }, (_, i) => ({
      display_name: `Model ${i}`,
      current_fucks: i,
      fuck_score: 3,
      status: 'normal',
    }));
    const text = formatFuckText({
      display_name: 'Test',
      current_fucks: 1,
      baseline_mean: 0,
      z_score: 0,
      fuck_score: 0,
      status: 'unknown',
      other_models: others,
    });
    const modelLines = text.split('\n').filter(l => l.startsWith('  ') && l.includes('fucks/hr'));
    expect(modelLines.length).toBeLessThanOrEqual(5);
  });
});
