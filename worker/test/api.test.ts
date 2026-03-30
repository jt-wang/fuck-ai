import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/index';
import type { Env } from '../src/types';

// Minimal D1 mock — in-memory store
function createMockD1(): D1Database {
  const tables: Record<string, any[]> = {
    fucks: [],
    models: [
      { slug: 'claude-opus-4-6', display_name: 'Claude Opus 4.6', provider: 'Anthropic', sort_order: 1 },
      { slug: 'gpt-4o', display_name: 'GPT-4o', provider: 'OpenAI', sort_order: 10 },
      { slug: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', provider: 'Google', sort_order: 20 },
    ],
    baselines: [
      { model: 'claude-opus-4-6', day_of_week: 1, hour_of_day: 14, ewma_mean: 30, ewma_std: 10, sample_count: 50 },
      { model: 'gpt-4o', day_of_week: 1, hour_of_day: 14, ewma_mean: 20, ewma_std: 8, sample_count: 50 },
      { model: 'gemini-2.5-pro', day_of_week: 1, hour_of_day: 14, ewma_mean: 10, ewma_std: 5, sample_count: 50 },
    ],
    model_shares: [
      { model: 'claude-opus-4-6', expected_share: 0.5, total_fucks: 5000 },
      { model: 'gpt-4o', expected_share: 0.33, total_fucks: 3300 },
      { model: 'gemini-2.5-pro', expected_share: 0.17, total_fucks: 1700 },
    ],
  };

  let fuckIdCounter = 0;

  const mockStmt = (query: string) => ({
    bind: (...params: any[]) => ({
      async first<T = any>(): Promise<T | null> {
        const q = query.trim().toUpperCase();

        // Model lookup
        if (q.includes('FROM MODELS') && q.includes('WHERE') && q.includes('SLUG')) {
          return (tables.models.find((m) => m.slug === params[0]) as T) ?? null;
        }

        // Baseline lookup — match by model only (ignore day/hour for testing)
        if (q.includes('FROM BASELINES') && q.includes('WHERE')) {
          const b = tables.baselines.find((b) => b.model === params[0]);
          return (b as T) ?? null;
        }

        // Model share lookup
        if (q.includes('FROM MODEL_SHARES') && q.includes('WHERE')) {
          return (tables.model_shares.find((s) => s.model === params[0]) as T) ?? null;
        }

        // Count fucks for model in hour
        if (q.includes('COUNT') && q.includes('FROM FUCKS') && q.includes('MODEL')) {
          const count = tables.fucks.filter(
            (f) => f.model === params[0] && f.hour_bucket === params[1],
          ).length;
          return { count } as T;
        }

        // Total fucks this hour
        if (q.includes('COUNT') && q.includes('FROM FUCKS') && !q.includes('MODEL')) {
          const count = tables.fucks.filter((f) => f.hour_bucket === params[0]).length;
          return { count } as T;
        }

        return null;
      },
      async all<T = any>(): Promise<D1Result<T>> {
        const q = query.trim().toUpperCase();

        // All models
        if (q.includes('FROM MODELS') && q.includes('ORDER BY')) {
          return { results: tables.models as T[], success: true, meta: {} as any };
        }

        // Model fucks per hour (for status endpoint)
        if (q.includes('FROM FUCKS') && q.includes('GROUP BY')) {
          const hourBucket = params[0];
          const grouped: Record<string, number> = {};
          for (const f of tables.fucks.filter((f) => f.hour_bucket === hourBucket)) {
            grouped[f.model] = (grouped[f.model] || 0) + 1;
          }
          const results = Object.entries(grouped).map(([model, count]) => ({
            model,
            fuck_count: count,
          }));
          return { results: results as T[], success: true, meta: {} as any };
        }

        // Baselines for all models — return all for testing
        if (q.includes('FROM BASELINES')) {
          return { results: tables.baselines as T[], success: true, meta: {} as any };
        }

        // Model shares
        if (q.includes('FROM MODEL_SHARES')) {
          return { results: tables.model_shares as T[], success: true, meta: {} as any };
        }

        // Hourly fucks for trend
        if (q.includes('FROM FUCKS') && q.includes('HOUR_BUCKET >=')) {
          return { results: [] as T[], success: true, meta: {} as any };
        }

        return { results: [] as T[], success: true, meta: {} as any };
      },
      async run(): Promise<D1Response> {
        const q = query.trim().toUpperCase();

        // INSERT fuck
        if (q.includes('INSERT') && q.includes('FUCKS')) {
          tables.fucks.push({
            id: ++fuckIdCounter,
            model: params[0],
            ip_hash: params[1],
            hour_bucket: params[2],
            day_of_week: params[3],
            hour_of_day: params[4],
          });
        }

        return { success: true, meta: {} as any } as D1Response;
      },
    }),
    // Unbound versions for queries without params
    async first<T = any>(): Promise<T | null> { return null; },
    async all<T = any>(): Promise<D1Result<T>> {
      const q = query.trim().toUpperCase();
      if (q.includes('FROM MODELS') && q.includes('ORDER BY')) {
        return { results: tables.models as T[], success: true, meta: {} as any };
      }
      return { results: [] as T[], success: true, meta: {} as any };
    },
    async run(): Promise<D1Response> {
      return { success: true, meta: {} as any } as D1Response;
    },
  });

  return {
    prepare: mockStmt,
    dump: async () => new ArrayBuffer(0),
    batch: async (stmts: any[]) => [],
    exec: async (q: string) => ({ count: 0, duration: 0 }),
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

function createEnv(): Env {
  return { DB: createMockD1(), RATE_LIMIT: createMockKV() };
}

function makeRequest(method: string, path: string, body?: any): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}

describe('API Routes', () => {
  const env = createEnv();

  describe('POST /api/fuck', () => {
    it('returns 400 for missing model', async () => {
      const res = await app.fetch(makeRequest('POST', '/api/fuck', {}), env);
      expect(res.status).toBe(400);
    });

    it('returns 400 for unknown model', async () => {
      const res = await app.fetch(makeRequest('POST', '/api/fuck', { model: 'nonexistent' }), env);
      expect(res.status).toBe(400);
    });

    it('records a fuck and returns score', async () => {
      const res = await app.fetch(makeRequest('POST', '/api/fuck', { model: 'claude-opus-4-6' }), env);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.model).toBe('claude-opus-4-6');
      expect(body.display_name).toBe('Claude Opus 4.6');
      expect(body.fuck_score).toBeGreaterThanOrEqual(1);
      expect(body.fuck_score).toBeLessThanOrEqual(5);
      expect(body.status).toBeTruthy();
      expect(body.current_fucks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/status', () => {
    it('returns status for all models', async () => {
      const res = await app.fetch(makeRequest('GET', '/api/status'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.models).toBeInstanceOf(Array);
      expect(body.models.length).toBeGreaterThanOrEqual(3);
      expect(body.hour_bucket).toBeTruthy();
      for (const m of body.models) {
        expect(m.model).toBeTruthy();
        expect(m.display_name).toBeTruthy();
        expect(m.provider).toBeTruthy();
        expect(m.fuck_score).toBeGreaterThanOrEqual(0);
        expect(m.fuck_score).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('GET /api/status/:model', () => {
    it('returns detailed status for a model', async () => {
      const res = await app.fetch(makeRequest('GET', '/api/status/claude-opus-4-6'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.model).toBe('claude-opus-4-6');
      expect(body.display_name).toBe('Claude Opus 4.6');
      expect(body.hours).toBeInstanceOf(Array);
    });

    it('returns 404 for unknown model', async () => {
      const res = await app.fetch(makeRequest('GET', '/api/status/nonexistent'), env);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/models', () => {
    it('returns list of known models', async () => {
      const res = await app.fetch(makeRequest('GET', '/api/models'), env);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.models).toBeInstanceOf(Array);
      expect(body.models[0].slug).toBeTruthy();
      expect(body.models[0].display_name).toBeTruthy();
    });
  });

  describe('CORS', () => {
    it('returns CORS headers on responses', async () => {
      const res = await app.fetch(makeRequest('GET', '/api/models'), env);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('handles OPTIONS preflight', async () => {
      const res = await app.fetch(makeRequest('OPTIONS', '/api/fuck'), env);
      expect(res.status).toBe(204);
    });
  });
});
