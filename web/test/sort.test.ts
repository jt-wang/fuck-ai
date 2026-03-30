import { describe, it, expect } from "vitest";
import type { ModelStatus } from "../src/lib/api";

// Will extract these from Dashboard.tsx into sort.ts
import { sortModels, hasSparkData } from "../src/lib/sort";

function makeModel(overrides: Partial<ModelStatus>): ModelStatus {
  return {
    model: "test-model",
    display_name: "Test Model",
    provider: "TestProvider",
    current_fucks: 0,
    fuck_score: 0,
    status: "unknown",
    z_score: 0,
    ...overrides,
  };
}

describe("sortModels by score", () => {
  it("sorts scored models descending by fuck_score", () => {
    const models = [
      makeModel({ model: "a", fuck_score: 2 }),
      makeModel({ model: "b", fuck_score: 5 }),
      makeModel({ model: "c", fuck_score: 3 }),
    ];
    const sorted = sortModels(models, "score");
    expect(sorted.map((m) => m.model)).toEqual(["b", "c", "a"]);
  });

  it("pushes fuck_score=0 models to the end", () => {
    const models = [
      makeModel({ model: "calibrating", fuck_score: 0 }),
      makeModel({ model: "scored", fuck_score: 3 }),
    ];
    const sorted = sortModels(models, "score");
    expect(sorted[0].model).toBe("scored");
    expect(sorted[1].model).toBe("calibrating");
  });

  it("uses current_fucks as tiebreaker when both fuck_score=0", () => {
    const models = [
      makeModel({ model: "zero", fuck_score: 0, current_fucks: 0 }),
      makeModel({ model: "one", fuck_score: 0, current_fucks: 1 }),
      makeModel({ model: "two", fuck_score: 0, current_fucks: 2 }),
    ];
    const sorted = sortModels(models, "score");
    expect(sorted.map((m) => m.model)).toEqual(["two", "one", "zero"]);
  });
});

describe("sortModels by name", () => {
  it("sorts alphabetically by display_name", () => {
    const models = [
      makeModel({ model: "c", display_name: "Claude" }),
      makeModel({ model: "a", display_name: "Alpha" }),
      makeModel({ model: "g", display_name: "GPT" }),
    ];
    const sorted = sortModels(models, "name");
    expect(sorted.map((m) => m.model)).toEqual(["a", "c", "g"]);
  });
});

describe("hasSparkData", () => {
  it("returns false for empty array", () => {
    expect(hasSparkData([])).toBe(false);
  });

  it("returns false when all values are 0", () => {
    expect(hasSparkData([0, 0, 0, 0])).toBe(false);
  });

  it("returns true when at least one value is non-zero", () => {
    expect(hasSparkData([0, 0, 1, 0])).toBe(true);
  });
});
