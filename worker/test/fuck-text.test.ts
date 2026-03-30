import { describe, it, expect } from 'vitest';
import { app } from '../src/index';

// Reuse the mock setup from api.test.ts pattern
function createMockD1(): D1Database {
  const tables: Record<string, any[]> = {
    fucks: [],
    models: [
      { slug: 'claude-opus-4-6', display_name: 'Claude Opus 4.6', provider: 'Anthropic', sort_order: 1 },
      { slug: 'gpt-4o', display_name: 'GPT-4o', provider: 'OpenAI', sort_order: 10 },
    ],
    baselines: [
      { model: 'claude-opus-4-6', day_of_week: 1, hour_of_day: 14, ewma_mean: 30, ewma_std: 10, sample_count: 50 },
    ],
    model_shares: [
      { model: 'claude-opus-4-6', expected_share: 0.5, total_fucks: 5000 },
    ],
  };

  let fuckId = 0;

  const mockStmt = (query: string) => ({
    bind: (...params: any[]) => ({
      async first<T = any>(): Promise<T | null> {
        const q = query.trim().toUpperCase();
        if (q.includes('FROM MODELS') && q.includes('WHERE') && q.includes('SLUG'))
          return (tables.models.find((m) => m.slug === params[0]) as T) ?? null;
        if (q.includes('FROM BASELINES') && q.includes('WHERE'))
          return (tables.baselines.find((b) => b.model === params[0]) as T) ?? null;
        if (q.includes('FROM MODEL_SHARES') && q.includes('WHERE'))
          return (tables.model_shares.find((s) => s.model === params[0]) as T) ?? null;
        if (q.includes('COUNT') && q.includes('FROM FUCKS') && q.includes('MODEL'))
          return { count: tables.fucks.filter((f) => f.model === params[0] && f.hour_bucket === params[1]).length } as T;
        if (q.includes('COUNT') && q.includes('FROM FUCKS'))
          return { count: tables.fucks.filter((f) => f.hour_bucket === params[0]).length } as T;
        return null;
      },
      async all<T = any>(): Promise<D1Result<T>> {
        const q = query.trim().toUpperCase();
        if (q.includes('FROM MODELS') && q.includes('ORDER BY'))
          return { results: tables.models.filter((m) => !q.includes('!=') || m.slug !== params[0]) as T[], success: true, meta: {} as any };
        if (q.includes('FROM FUCKS') && q.includes('GROUP BY')) {
          const grouped: Record<string, number> = {};
          for (const f of tables.fucks.filter((f) => f.hour_bucket === params[0])) {
            grouped[f.model] = (grouped[f.model] || 0) + 1;
          }
          return { results: Object.entries(grouped).map(([model, count]) => ({ model, fuck_count: count })) as T[], success: true, meta: {} as any };
        }
        return { results: [] as T[], success: true, meta: {} as any };
      },
      async run(): Promise<D1Response> {
        const q = query.trim().toUpperCase();
        if (q.includes('INSERT') && q.includes('FUCKS')) {
          tables.fucks.push({ id: ++fuckId, model: params[0], ip_hash: params[1], hour_bucket: params[2], day_of_week: params[3], hour_of_day: params[4] });
        }
        return { success: true, meta: {} as any } as D1Response;
      },
    }),
    async first<T = any>(): Promise<T | null> { return null; },
    async all<T = any>(): Promise<D1Result<T>> { return { results: [] as T[], success: true, meta: {} as any }; },
    async run(): Promise<D1Response> { return { success: true, meta: {} as any } as D1Response; },
  });

  return {
    prepare: mockStmt,
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

function createMockKV(): KVNamespace {
  const store: Record<string, string> = {};
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string) => { store[key] = value; },
    delete: async (key: string) => { delete store[key]; },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

describe('POST /api/fuck/:model/text', () => {
  const env = { DB: createMockD1(), RATE_LIMIT: createMockKV() };

  function req(model: string) {
    return new Request(`http://localhost/api/fuck/${model}/text`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    });
  }

  it('returns plain text, not JSON', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('returns 200 for valid model', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    expect(res.status).toBe(200);
  });

  it('returns 400 for unknown model', async () => {
    const res = await app.fetch(req('nonexistent'), env);
    expect(res.status).toBe(400);
  });

  it('contains "Recorded" in response', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    const text = await res.text();
    expect(text).toContain('Recorded');
  });

  it('contains model display name', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    const text = await res.text();
    expect(text).toContain('Claude Opus 4.6');
  });

  it('contains fucks/hr count', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    const text = await res.text();
    expect(text).toContain('fucks/hr');
  });

  it('contains dashboard link', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    const text = await res.text();
    expect(text).toContain('fuck-ai.dev');
  });

  it('is ready to display as-is (no JSON parsing needed)', async () => {
    const res = await app.fetch(req('claude-opus-4-6'), env);
    const text = await res.text();
    // Should NOT be valid JSON
    expect(() => JSON.parse(text)).toThrow();
    // Should be human-readable lines
    expect(text.split('\n').length).toBeGreaterThan(2);
  });
});
