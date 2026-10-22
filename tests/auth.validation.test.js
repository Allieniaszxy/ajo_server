import { describe, it, expect } from "vitest";
import { registerSchema } from "../src/modules/auth/auth.validation.js";

const valid = {
  fullName: "Ada Obi",
  email: "  Ada@Example.COM ",
  password: "correct-horse-9",
};
const parse = (body) => registerSchema.body.safeParse(body);

describe("registerSchema", () => {
  it("normalises the email", () => {
    const r = parse(valid);
    expect(r.success).toBe(true);
    expect(r.data.email).toBe("ada@example.com");
  });

  it("rejects unknown keys such as platformRole", () => {
    expect(parse({ ...valid, platformRole: "platform_admin" }).success).toBe(
      false,
    );
  });

  it("drops an empty phone instead of storing it", () => {
    const r = parse({ ...valid, phone: "" });
    expect(r.success).toBe(true);
    expect(r.data.phone).toBeUndefined();
  });

  it("rejects short and oversized passwords", () => {
    expect(parse({ ...valid, password: "short" }).success).toBe(false);
    expect(parse({ ...valid, password: "x".repeat(129) }).success).toBe(false);
  });
});
