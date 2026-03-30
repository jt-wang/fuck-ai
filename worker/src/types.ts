export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
}

export interface FuckRequest {
  model: string;
}

export interface FuckResponse {
  ok: true;
  model: string;
  display_name: string;
  current_fucks: number;
  baseline_mean: number;
  z_score: number;
  current_share: number;
  expected_share: number;
  disproportionality: number;
  fuck_score: number;
  status: FuckStatus;
  other_models: ModelStatus[];
}

export interface ModelStatus {
  model: string;
  display_name: string;
  provider: string;
  current_fucks: number;
  fuck_score: number;
  status: FuckStatus;
  z_score: number;
}

export type FuckStatus = 'genius' | 'smart' | 'normal' | 'dumb' | 'braindead' | 'unknown';

export interface Baseline {
  model: string;
  day_of_week: number;
  hour_of_day: number;
  ewma_mean: number;
  ewma_std: number;
  sample_count: number;
}

export interface ModelShare {
  model: string;
  expected_share: number;
  total_fucks: number;
}

export interface ModelInfo {
  slug: string;
  display_name: string;
  provider: string;
  sort_order: number;
}

export interface HourBucket {
  hour_bucket: string;
  day_of_week: number;
  hour_of_day: number;
}
