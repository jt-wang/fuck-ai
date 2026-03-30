import type { ModelStatus } from "./api";

export type SortMode = "score" | "name";

export function sortModels(models: ModelStatus[], sortMode: SortMode): ModelStatus[] {
  return [...models].sort((a, b) => {
    if (sortMode === "name") {
      return a.display_name.localeCompare(b.display_name);
    }
    // sort by score: scored models first (descending), then unscored
    if (a.fuck_score === 0 && b.fuck_score === 0) return b.current_fucks - a.current_fucks;
    if (a.fuck_score === 0) return 1;
    if (b.fuck_score === 0) return -1;
    return b.fuck_score - a.fuck_score;
  });
}

/** Returns true if sparkline data has at least one non-zero point worth showing */
export function hasSparkData(data: number[]): boolean {
  return data.length > 0 && data.some((v) => v > 0);
}
