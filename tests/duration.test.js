import { describe, it, expect } from "vitest";
import { parseDuration } from "../src/utils/duration.js";

describe("parseDuration", () => {
  it("converts each unit to milliseconds", () => {
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("15m")).toBe(900_000);
    expect(parseDuration("2h")).toBe(7_200_000);
    expect(parseDuration("7d")).toBe(604_800_000);
  });

  it("throws on anything unexpected", () => {
    for (const bad of ["", "15", "m", "1w", "-5m", "1.5h", "15 m"]) {
      expect(() => parseDuration(bad)).toThrow();
    }
  });
});
