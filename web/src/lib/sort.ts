import type { ModelStatus } from "./api";

export type SortMode = "score" | "name";
export type SortDirection = "desc" | "asc";

export function sortModels(models: ModelStatus[], sortMode: SortMode, direction: SortDirection = "desc"): ModelStatus[] {
  return [...models].sort((a, b) => {
    if (sortMode === "name") {
      const cmp = a.display_name.localeCompare(b.display_name);
      return direction === "asc" ? cmp : -cmp;
    }
    // unscored models always sink to the end regardless of direction
    if (a.fuck_score === 0 && b.fuck_score === 0) {
      const cmp = b.current_fucks - a.current_fucks;
      return direction === "desc" ? cmp : -cmp;
    }
    if (a.fuck_score === 0) return 1;
    if (b.fuck_score === 0) return -1;
    const cmp = b.fuck_score - a.fuck_score;
    return direction === "desc" ? cmp : -cmp;
  });
}

/** Returns true if sparkline data has at least one non-zero point worth showing */
export function hasSparkData(data: number[]): boolean {
  return data.length > 0 && data.some((v) => v > 0);
}
