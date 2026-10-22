import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { useTestDb } from "./helpers/db.js";

// Mock the mailer before the app loads
vi.mock("../src/utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(),
}));

import { app } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";
import { OneTimeToken } from "../src/modules/auth/oneTimeToken.model.js";
import { sendMail } from "../src/utils/mailer.js";
import { hashToken } from "../src/utils/crypto.js";

useTestDb();
beforeEach(() => vi.clearAllMocks());

const payload = {
  fullName: "Ada Obi",
  email: "ada@example.com",
  password: "correct-horse-9",
};
const post = (body) => request(app).post("/api/v1/auth/register").send(body);

describe("POST /auth/register", () => {
  it("creates an account without leaking secrets", async () => {
    const res = await post(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const stored = await User.findOne({ email: payload.email }).select(
      "+passwordHash",
    );
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(stored.status).toBe("pending_verification");
  });

  it("returns 409 for a duplicate email", async () => {
    await post(payload);
    const res = await post(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects privileged fields (mass assignment)", async () => {
    const res = await post({ ...payload, platformRole: "platform_admin" });
    expect(res.status).toBe(400);
  });

  it("stores only a hash of the verification token", async () => {
    await post(payload);
    const emailText = vi.mocked(sendMail).mock.calls.at(-1)[0].text;
    const rawToken = emailText.match(/token=([\w-]+)/)[1];

    const stored = await OneTimeToken.findOne({});
    expect(stored.tokenHash).toBe(hashToken(rawToken));
    expect(stored.tokenHash).not.toBe(rawToken);
  });

  it("still registers the user when the email fails to send", async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("smtp down"));
    const res = await post(payload);
    expect(res.status).toBe(201);
    expect(await User.countDocuments({ email: payload.email })).toBe(1);
  });
});
