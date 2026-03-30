import { describe, it, expect } from "vitest";
import { formatHourLabel } from "../src/lib/format";

describe("formatHourLabel", () => {
  it("converts UTC hour_bucket to local time string", () => {
    const label = formatHourLabel("2026-03-30T14:00:00Z");
    // Should be HH:MM in local timezone — exact value depends on TZ
    expect(label).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("returns a different result from raw UTC when offset is non-zero", () => {
    // This test validates conversion happens (will pass in any non-UTC timezone)
    const offset = new Date().getTimezoneOffset();
    if (offset !== 0) {
      expect(formatHourLabel("2026-03-30T00:00:00Z")).not.toBe("0:00");
    }
  });

  it("parses the ISO string as a Date and uses local hours", () => {
    const iso = "2026-03-30T14:00:00Z";
    const expected = new Date(iso);
    const expectedLabel = `${expected.getHours()}:${String(expected.getMinutes()).padStart(2, "0")}`;
    expect(formatHourLabel(iso)).toBe(expectedLabel);
  });
});
