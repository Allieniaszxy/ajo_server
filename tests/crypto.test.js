import { describe, it, expect } from "vitest";
import { randomToken, hashToken } from "../src/utils/crypto.js";

describe("crypto utils", () => {
  it("generates unique URL-safe tokens", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(randomToken());
  });

  it("refuses weak token sizes", () => {
    expect(() => randomToken(4)).toThrow(RangeError);
  });

  it("hashes deterministically to 64 hex chars", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects empty or non-string input", () => {
    expect(() => hashToken("")).toThrow(TypeError);
    expect(() => hashToken(undefined)).toThrow(TypeError);
  });
});
