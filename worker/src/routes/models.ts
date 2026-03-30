import type { Context } from 'hono';
import type { Env } from '../types';

export async function modelsRoute(c: Context<{ Bindings: Env }>) {
  const result = await c.env.DB.prepare(
    'SELECT slug, display_name, provider, sort_order FROM models ORDER BY sort_order',
  ).all<{ slug: string; display_name: string; provider: string; sort_order: number }>();

  return c.json({ models: result.results });
}
