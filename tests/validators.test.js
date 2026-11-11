import { describe, it, expect } from "vitest";
import {
  emailField,
  optionalPhoneField,
  phoneUpdateField,
  newPasswordField,
} from "../src/utils/validators.js";

describe("validators", () => {
  it("normalises emails and rejects invalid ones", () => {
    expect(emailField.parse("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(emailField.safeParse("not-an-email").success).toBe(false);
    expect(emailField.safeParse({ $ne: null }).success).toBe(false); // no operator injection
  });

  it("cleans phone numbers and rejects bad ones", () => {
    expect(optionalPhoneField.parse("0803 123-4567")).toBe("08031234567");
    expect(optionalPhoneField.parse("+234 803 123 4567")).toBe(
      "+2348031234567",
    );
    expect(optionalPhoneField.parse("")).toBeUndefined();
    expect(optionalPhoneField.parse(undefined)).toBeUndefined();
    expect(optionalPhoneField.safeParse("abc").success).toBe(false);
    expect(optionalPhoneField.safeParse("123").success).toBe(false);
  });

  it("treats an empty or null phone as 'remove' on updates", () => {
    expect(phoneUpdateField.parse("")).toBeNull();
    expect(phoneUpdateField.parse(null)).toBeNull();
    expect(phoneUpdateField.parse(undefined)).toBeUndefined();
    expect(phoneUpdateField.parse("08031234567")).toBe("08031234567");
  });

  it("enforces password length without trimming", () => {
    expect(newPasswordField.safeParse("short").success).toBe(false);
    expect(newPasswordField.safeParse("x".repeat(129)).success).toBe(false);
    expect(newPasswordField.parse("  spaces are fine  ")).toBe(
      "  spaces are fine  ",
    );
  });
});
