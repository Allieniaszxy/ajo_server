import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "./helpers/db.js";
import { createUser } from "./helpers/users.js";
import { loginAs, refreshWith, bearer } from "./helpers/auth.js";

vi.mock("../src/utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(),
}));

import { app } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";
import { TOKEN_TYPES } from "../src/modules/auth/oneTimeToken.model.js";
import { issueToken } from "../src/modules/auth/oneTimeToken.service.js";
import { sendMail } from "../src/utils/mailer.js";

useTestDb();
beforeEach(() => vi.clearAllMocks());

const forgot = (email) =>
  request(app).post("/api/v1/auth/forgot-password").send({ email });
const reset = (token, password) =>
  request(app).post("/api/v1/auth/reset-password").send({ token, password });
const lastMail = () => vi.mocked(sendMail).mock.calls.at(-1)?.[0];
const tokenFromLastMail = () => lastMail().text.match(/token=([\w-]+)/)[1];

const OLD = "correct-horse-9";
const NEW = "brand-new-password-7";

describe("POST /auth/forgot-password", () => {
  it("answers identically for known and unknown emails, and only mails real accounts", async () => {
    await createUser();

    const known = await forgot("ada@example.com");
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    expect(lastMail().to).toBe("ada@example.com");
    expect(lastMail().subject).toMatch(/reset/i);

    const unknown = await forgot("nobody@example.com");
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1); // no second email

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  it("does not send reset links to unverified accounts", async () => {
    await createUser({ status: "pending_verification" });
    await forgot("ada@example.com");
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("POST /auth/reset-password", () => {
  it("resets the password, signs out every device, and clears any lockout", async () => {
    const { user } = await createUser();
    const device = await loginAs(app);
    await User.updateOne(
      { _id: user._id },
      { failedLoginAttempts: 3, lockUntil: new Date(Date.now() + 600_000) },
    );

    await forgot("ada@example.com");
    const res = await reset(tokenFromLastMail(), NEW);
    expect(res.status).toBe(200);

    expect((await loginAs(app, { password: OLD })).res.status).toBe(401);
    expect((await loginAs(app, { password: NEW })).res.status).toBe(200);
    expect((await refreshWith(app, device.refreshCookie)).status).toBe(401);

    // And the owner is told about it
    expect(
      vi.mocked(sendMail).mock.calls.some(([m]) => /changed/i.test(m.subject)),
    ).toBe(true);
  });

  it("works once only", async () => {
    await createUser();
    await forgot("ada@example.com");
    const token = tokenFromLastMail();

    expect((await reset(token, NEW)).status).toBe(200);
    const second = await reset(token, "another-password-8");
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("INVALID_TOKEN");
  });

  it("only the newest link works after asking twice", async () => {
    await createUser();
    await forgot("ada@example.com");
    const first = tokenFromLastMail();
    await forgot("ada@example.com");
    const second = tokenFromLastMail();

    expect((await reset(first, NEW)).status).toBe(400);
    expect((await reset(second, NEW)).status).toBe(200);
  });

  it("refuses an email-verification token", async () => {
    const { user } = await createUser();
    const wrongType = await issueToken(user._id, TOKEN_TYPES.EMAIL_VERIFY);
    expect((await reset(wrongType, NEW)).status).toBe(400);
  });

  it("enforces the password policy", async () => {
    await createUser();
    await forgot("ada@example.com");
    const res = await reset(tokenFromLastMail(), "short");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("leaves the old password working when the token is bad", async () => {
    await createUser();
    const res = await reset("x".repeat(43), NEW);
    expect(res.status).toBe(400);
    expect((await loginAs(app, { password: OLD })).res.status).toBe(200);
  });
});

describe("POST /users/me/change-password", () => {
  const change = (token, body) =>
    request(app)
      .post("/api/v1/users/me/change-password")
      .set(bearer(token))
      .send(body);

  it("requires the current password", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);

    const res = await change(accessToken, {
      currentPassword: "wrong-password-1",
      newPassword: NEW,
    });
    expect(res.status).toBe(400); // 400, not 401: the session itself is fine
    expect(res.body.error.code).toBe("INCORRECT_PASSWORD");
    expect((await loginAs(app, { password: OLD })).res.status).toBe(200);
  });

  it("changes the password, keeps this device, and signs out the others", async () => {
    await createUser();
    const phone = await loginAs(app);
    const laptop = await loginAs(app);

    const res = await change(phone.accessToken, {
      currentPassword: OLD,
      newPassword: NEW,
    });
    expect(res.status).toBe(200);

    expect((await refreshWith(app, phone.refreshCookie)).status).toBe(200); // this device stays
    expect((await refreshWith(app, laptop.refreshCookie)).status).toBe(401); // the other is out
    expect((await loginAs(app, { password: OLD })).res.status).toBe(401);
    expect((await loginAs(app, { password: NEW })).res.status).toBe(200);
  });

  it("rejects reusing the same password", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);
    const res = await change(accessToken, {
      currentPassword: OLD,
      newPassword: OLD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
