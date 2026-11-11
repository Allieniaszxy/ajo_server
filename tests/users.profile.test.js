import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "./helpers/db.js";
import { createUser } from "./helpers/users.js";
import { loginAs, bearer } from "./helpers/auth.js";

vi.mock("../src/utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(),
}));

import { app } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";

useTestDb();
beforeEach(() => vi.clearAllMocks());

const patch = (token, body) =>
  request(app).patch("/api/v1/users/me").set(bearer(token)).send(body);

describe("PATCH /users/me", () => {
  it("updates the name and normalises the phone number", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);

    const res = await patch(accessToken, {
      fullName: "  Ada Nwosu ",
      phone: "0803 123 4567",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      fullName: "Ada Nwosu",
      phone: "08031234567",
    });
  });

  it("removes the phone number when given an empty value", async () => {
    await createUser({ phone: "08031234567" });
    const { accessToken } = await loginAs(app);

    const res = await patch(accessToken, { phone: "" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBeNull();
    expect(
      (await User.findOne({ email: "ada@example.com" })).phone,
    ).toBeUndefined();
  });

  it("refuses fields a user must not change", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);

    for (const body of [
      { platformRole: "platform_admin" },
      { status: "active" },
      { email: "other@example.com" },
      { passwordHash: "x" },
    ]) {
      expect(
        (await patch(accessToken, body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
    expect(
      (await User.findOne({ email: "ada@example.com" })).platformRole,
    ).toBe("user");
  });

  it("rejects an empty update", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);
    expect((await patch(accessToken, {})).status).toBe(400);
  });

  it("returns 409 when the phone number belongs to someone else", async () => {
    await createUser({ email: "bola@example.com", phone: "08031234567" });
    await createUser({ email: "ada@example.com" });
    const { accessToken } = await loginAs(app);

    const res = await patch(accessToken, { phone: "08031234567" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PHONE_TAKEN");
  });
});
