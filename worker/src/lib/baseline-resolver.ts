import type { Env } from '../types';
import type { BaselineTier } from './scoring';

/**
 * Three tiers of baseline data, from most to least precise.
 *
 * Tier 1 (slot):      Exact (model, day_of_week, hour_of_day) — updates 1x/week
 * Tier 2 (hour):      Same hour_of_day across all days — updates 1x/day
 * Tier 3 (aggregate): All slots for the model — updates 24x/day
 */
export interface BaselineTiers {
  slot: BaselineTier | null;
  hour: BaselineTier | null;
  aggregate: BaselineTier | null;
}

type DB = Env['DB'];

/**
 * Load three-tier baselines for a single model.
 */
export async function loadModelBaselines(
  db: DB,
  model: string,
  dayOfWeek: number,
  hourOfDay: number,
): Promise<BaselineTiers> {
  const [slotRow, hourRow, aggRow] = await Promise.all([
    db.prepare(
      'SELECT ewma_mean, ewma_std, sample_count FROM baselines WHERE model = ? AND day_of_week = ? AND hour_of_day = ?',
    ).bind(model, dayOfWeek, hourOfDay).first<{ ewma_mean: number; ewma_std: number; sample_count: number }>(),

    db.prepare(
      'SELECT AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines WHERE model = ? AND hour_of_day = ?',
    ).bind(model, hourOfDay).first<{ avg_mean: number; avg_std: number; total_samples: number }>(),

    db.prepare(
      'SELECT AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines WHERE model = ?',
    ).bind(model).first<{ avg_mean: number; avg_std: number; total_samples: number }>(),
  ]);

  return {
    slot: slotRow ? { mean: slotRow.ewma_mean, std: slotRow.ewma_std, samples: slotRow.sample_count } : null,
    hour: hourRow?.total_samples ? { mean: hourRow.avg_mean, std: hourRow.avg_std, samples: hourRow.total_samples } : null,
    aggregate: aggRow?.total_samples ? { mean: aggRow.avg_mean, std: aggRow.avg_std, samples: aggRow.total_samples } : null,
  };
}

/**
 * Batch-load three-tier baselines for all models at once.
 * Returns a Map from model slug to its baseline tiers.
 * Used by routes that need to score all models (status-all, fuck response).
 */
export async function loadAllModelBaselines(
  db: DB,
  dayOfWeek: number,
  hourOfDay: number,
): Promise<Map<string, BaselineTiers>> {
  const [slotRows, hourRows, aggRows] = await Promise.all([
    db.prepare(
      'SELECT model, ewma_mean, ewma_std, sample_count FROM baselines WHERE day_of_week = ? AND hour_of_day = ?',
    ).bind(dayOfWeek, hourOfDay).all<{ model: string; ewma_mean: number; ewma_std: number; sample_count: number }>(),

    db.prepare(
      'SELECT model, AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines WHERE hour_of_day = ? GROUP BY model',
    ).bind(hourOfDay).all<{ model: string; avg_mean: number; avg_std: number; total_samples: number }>(),

    db.prepare(
      'SELECT model, AVG(ewma_mean) as avg_mean, AVG(ewma_std) as avg_std, SUM(sample_count) as total_samples FROM baselines GROUP BY model',
    ).all<{ model: string; avg_mean: number; avg_std: number; total_samples: number }>(),
  ]);

  const slotMap = new Map(slotRows.results.map(b => [b.model, b]));
  const hourMap = new Map(hourRows.results.map(b => [b.model, b]));
  const aggMap = new Map(aggRows.results.map(b => [b.model, b]));

  const result = new Map<string, BaselineTiers>();
  const allModels = new Set([...slotMap.keys(), ...hourMap.keys(), ...aggMap.keys()]);

  for (const model of allModels) {
    const sl = slotMap.get(model);
    const hr = hourMap.get(model);
    const ag = aggMap.get(model);
    result.set(model, {
      slot: sl ? { mean: sl.ewma_mean, std: sl.ewma_std, samples: sl.sample_count } : null,
      hour: hr?.total_samples ? { mean: hr.avg_mean, std: hr.avg_std, samples: hr.total_samples } : null,
      aggregate: ag?.total_samples ? { mean: ag.avg_mean, std: ag.avg_std, samples: ag.total_samples } : null,
    });
  }

  return result;
}
