import { describe, it, expect } from 'vitest';
import { hashIP } from '../src/lib/hash';

describe('hashIP', () => {
  it('returns a hex string', async () => {
    const hash = await hashIP('192.168.1.1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output', async () => {
    const h1 = await hashIP('10.0.0.1');
    const h2 = await hashIP('10.0.0.1');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different IPs', async () => {
    const h1 = await hashIP('10.0.0.1');
    const h2 = await hashIP('10.0.0.2');
    expect(h1).not.toBe(h2);
  });
});
