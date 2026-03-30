import type { Env } from '../types';

export interface OpenRouterModel {
  id: string;
  name: string;
}

interface ParsedModel {
  slug: string;
  display_name: string;
  provider: string;
}

/**
 * Map OpenRouter provider prefixes to our display provider names.
 * Only models from these providers are synced — everything else is skipped.
 */
export const PROVIDER_MAP: Record<string, string> = {
  'anthropic': 'Anthropic',
  'openai': 'OpenAI',
  'google': 'Google',
  'x-ai': 'xAI',
  'deepseek': 'DeepSeek',
  'meta-llama': 'Meta',
  'qwen': 'Qwen',
  'mistralai': 'Mistral',
  'moonshotai': 'Moonshot',
  'minimax': 'MiniMax',
  'z-ai': 'Zhipu',
  'bytedance-seed': 'ByteDance',
  'xiaomi': 'Xiaomi',
  'nvidia': 'NVIDIA',
  'stepfun': 'StepFun',
};

/**
 * Normalize a slug for deduplication.
 * Strips all non-alphanumeric characters and lowercases.
 * This makes 'claude-opus-4-6' and 'claude-opus-4.6' equivalent.
 */
export function normalizeForDedup(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parse an OpenRouter model into our internal format.
 * Returns null if the model should be skipped (unknown provider, :free variant, etc).
 */
export function parseOpenRouterModel(model: OpenRouterModel): ParsedModel | null {
  const { id, name } = model;

  // Skip tagged variants (:free, :thinking, :extended, etc.)
  if (id.includes(':')) return null;

  // Split provider/model-slug
  const slashIdx = id.indexOf('/');
  if (slashIdx === -1) return null;

  const providerKey = id.substring(0, slashIdx);
  const slug = id.substring(slashIdx + 1);

  const provider = PROVIDER_MAP[providerKey];
  if (!provider) return null;

  // Strip "Provider: " prefix from display name if present
  const colonIdx = name.indexOf(': ');
  const display_name = colonIdx !== -1 ? name.substring(colonIdx + 2) : name;

  return { slug, display_name, provider };
}

/**
 * Sort order ranges by provider.
 * Synced models get sort_order starting at the provider's base + 100
 * to avoid colliding with manually seeded models.
 */
const PROVIDER_SORT_BASE: Record<string, number> = {
  'Anthropic': 100,
  'OpenAI': 200,
  'Google': 300,
  'xAI': 400,
  'DeepSeek': 500,
  'Meta': 600,
  'Qwen': 700,
  'Mistral': 800,
  'Moonshot': 900,
  'MiniMax': 1000,
  'Zhipu': 1100,
  'ByteDance': 1200,
  'Xiaomi': 1300,
  'NVIDIA': 1400,
  'StepFun': 1500,
};

/**
 * Weekly cron job: fetch models from OpenRouter and add new ones.
 * Add-only — never removes existing models.
 */
export async function syncModels(env: Env): Promise<{ added: string[] }> {
  // Fetch from OpenRouter
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}`);
  }
  const data = (await res.json()) as { data: OpenRouterModel[] };

  // Get existing model slugs for dedup
  const existing = await env.DB.prepare('SELECT slug FROM models').all<{ slug: string }>();
  const existingNormalized = new Set(existing.results.map((m) => normalizeForDedup(m.slug)));

  // Track sort_order counters per provider
  const sortCounters: Record<string, number> = {};

  const added: string[] = [];

  for (const model of data.data) {
    const parsed = parseOpenRouterModel(model);
    if (!parsed) continue;

    // Dedup: skip if normalized form already exists
    const norm = normalizeForDedup(parsed.slug);
    if (existingNormalized.has(norm)) continue;

    // Compute sort_order
    const base = PROVIDER_SORT_BASE[parsed.provider] ?? 9000;
    sortCounters[parsed.provider] = (sortCounters[parsed.provider] ?? 0) + 1;
    const sortOrder = base + sortCounters[parsed.provider];

    await env.DB.prepare(
      'INSERT OR IGNORE INTO models (slug, display_name, provider, sort_order) VALUES (?, ?, ?, ?)',
    )
      .bind(parsed.slug, parsed.display_name, parsed.provider, sortOrder)
      .run();

    existingNormalized.add(norm);
    added.push(parsed.slug);
  }

  return { added };
}
