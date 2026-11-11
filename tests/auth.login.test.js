import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "./helpers/db.js";
import { createUser } from "./helpers/users.js";

vi.mock("../src/utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(),
}));

import { app } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";
import { Session } from "../src/modules/auth/session.model.js";
import { TOKEN_TYPES } from "../src/modules/auth/oneTimeToken.model.js";
import { issueToken } from "../src/modules/auth/oneTimeToken.service.js";
import { hashToken } from "../src/utils/crypto.js";

useTestDb();
beforeEach(() => vi.clearAllMocks());

const login = (body) => request(app).post("/api/v1/auth/login").send(body);

describe("POST /auth/login", () => {
  it("logs in, returns an access token, and sets a scoped httpOnly refresh cookie", async () => {
    const { password } = await createUser();
    const res = await login({ email: "ada@example.com", password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refresh/i);

    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    // Only the hash is stored
    const raw = cookie.match(/refresh_token=([^;]+)/)[1];
    expect(await Session.findOne({ tokenHash: hashToken(raw) })).toBeTruthy();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser();
    const wrong = await login({
      email: "ada@example.com",
      password: "wrong-password-1",
    });
    const unknown = await login({
      email: "nobody@example.com",
      password: "wrong-password-1",
    });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("does not leak account status to someone without the password", async () => {
    const { password } = await createUser({ status: "pending_verification" });

    const right = await login({ email: "ada@example.com", password });
    expect(right.status).toBe(403);
    expect(right.body.error.code).toBe("EMAIL_NOT_VERIFIED");

    const wrong = await login({
      email: "ada@example.com",
      password: "wrong-password-1",
    });
    expect(wrong.status).toBe(401);
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    const { password } = await createUser();
    for (let i = 0; i < 5; i++) {
      await login({ email: "ada@example.com", password: "wrong-password-1" });
    }
    const res = await login({ email: "ada@example.com", password });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
  });
});

describe("POST /auth/verify-email", () => {
  it("activates the account once, and the link cannot be reused", async () => {
    const { user } = await createUser({ status: "pending_verification" });
    const token = await issueToken(user._id, TOKEN_TYPES.EMAIL_VERIFY);
    const verify = () =>
      request(app).post("/api/v1/auth/verify-email").send({ token });

    expect((await verify()).status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.status).toBe("active");
    expect(updated.emailVerifiedAt).toBeTruthy();

    const second = await verify();
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("INVALID_TOKEN");
  });

  it("does not reactivate a suspended user", async () => {
    const { user } = await createUser({ status: "suspended" });
    const token = await issueToken(user._id, TOKEN_TYPES.EMAIL_VERIFY);
    await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect((await User.findById(user._id)).status).toBe("suspended");
  });

  it("refuses a password-reset token", async () => {
    const { user } = await createUser({ status: "pending_verification" });
    const token = await issueToken(user._id, TOKEN_TYPES.PASSWORD_RESET);
    const res = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token });
    expect(res.status).toBe(400);
  });
});
