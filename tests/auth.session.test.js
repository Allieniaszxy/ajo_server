import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { useTestDb } from "./helpers/db.js";
import { createUser } from "./helpers/users.js";
import { loginAs, refreshWith, bearer } from "./helpers/auth.js";

vi.mock("../src/utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue(),
}));

import { app } from "../src/app.js";
import { User } from "../src/modules/users/user.model.js";
import { Session } from "../src/modules/auth/session.model.js";

useTestDb();
beforeEach(() => vi.clearAllMocks());

const me = (token) => request(app).get("/api/v1/users/me").set(bearer(token));

describe("GET /users/me (authenticate)", () => {
  it("returns the profile for a valid token and leaks nothing secret", async () => {
    await createUser();
    const { accessToken } = await loginAs(app);

    const res = await me(accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("ada@example.com");
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|failedLoginAttempts|lockUntil/,
    );
  });

  it("answers TOKEN_EXPIRED for an expired token, so the client knows to refresh", async () => {
    const { user } = await createUser();
    const expired = jwt.sign(
      { role: "user", sid: "x", exp: Math.floor(Date.now() / 1000) - 60 },
      "a".repeat(64),
      { subject: user.id, algorithm: "HS256", issuer: "ajo-api" },
    );
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("blocks a suspended user immediately, even with an unexpired token", async () => {
    const { user } = await createUser();
    const { accessToken } = await loginAs(app);
    await User.updateOne({ _id: user._id }, { status: "suspended" });

    const res = await me(accessToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { user } = await createUser();
    const { accessToken } = await loginAs(app);
    await User.deleteOne({ _id: user._id });
    expect((await me(accessToken)).status).toBe(401);
  });
});

describe("POST /auth/refresh (rotation and reuse detection)", () => {
  it("rotates: new tokens, same family, old token burned", async () => {
    await createUser();
    const first = await loginAs(app);

    const res = await refreshWith(app, first.refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/refresh/i);

    const newCookie = res.headers["set-cookie"][0].split(";")[0];
    expect(newCookie).not.toBe(first.refreshCookie);
    expect((await me(res.body.data.accessToken)).status).toBe(200);

    const sessions = await Session.find({});
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.familyId)).size).toBe(1);
    expect(sessions.filter((s) => s.revokedReason === "rotated")).toHaveLength(
      1,
    );
  });

  it("fails without a cookie and clears it", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"][0]).toMatch(/^refresh_token=;/);
  });

  it("does not punish a racing second tab inside the grace window", async () => {
    await createUser();
    const first = await loginAs(app);
    const winner = await refreshWith(app, first.refreshCookie);
    const newCookie = winner.headers["set-cookie"][0].split(";")[0];

    const loser = await refreshWith(app, first.refreshCookie); // same old token, moments later
    expect(loser.status).toBe(401);

    // The session survives: the winner's new token still works
    expect((await refreshWith(app, newCookie)).status).toBe(200);
  });

  it("treats a replayed old token as theft and revokes the whole family", async () => {
    await createUser();
    const first = await loginAs(app);
    const rotated = await refreshWith(app, first.refreshCookie);
    const newCookie = rotated.headers["set-cookie"][0].split(";")[0];

    // Pretend the rotation happened a minute ago, outside the grace window
    await Session.updateMany(
      { revokedReason: "rotated" },
      { revokedAt: new Date(Date.now() - 60_000) },
    );

    const replay = await refreshWith(app, first.refreshCookie);
    expect(replay.status).toBe(401);

    // The thief's replay also killed the legitimate newest token
    expect((await refreshWith(app, newCookie)).status).toBe(401);
    expect(
      await Session.countDocuments({ revokedReason: "reuse_detected" }),
    ).toBe(1);
  });

  it("only one of two truly concurrent refreshes can win", async () => {
    await createUser();
    const { refreshCookie } = await loginAs(app);

    const [a, b] = await Promise.all([
      refreshWith(app, refreshCookie),
      refreshWith(app, refreshCookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it("ends a session once SESSION_MAX_AGE has passed, however often it was refreshed", async () => {
    await createUser();
    const { refreshCookie } = await loginAs(app);
    await Session.updateMany(
      {},
      { familyStartedAt: new Date(Date.now() - 31 * 86_400_000) },
    );

    const res = await refreshWith(app, refreshCookie);
    expect(res.status).toBe(401);
    expect(
      await Session.countDocuments({ revokedReason: "session_expired" }),
    ).toBe(1);
  });

  it("refuses to refresh for a suspended user", async () => {
    const { user } = await createUser();
    const { refreshCookie } = await loginAs(app);
    await User.updateOne({ _id: user._id }, { status: "suspended" });

    expect((await refreshWith(app, refreshCookie)).status).toBe(401);
  });

  it("refuses a foreign Origin before touching the session", async () => {
    await createUser();
    const { refreshCookie } = await loginAs(app);

    const res = await refreshWith(app, refreshCookie).set(
      "Origin",
      "https://evil.example",
    );
    expect(res.status).toBe(403);
    // The token was not consumed
    expect((await refreshWith(app, refreshCookie)).status).toBe(200);
  });
});

describe("logout", () => {
  it("revokes the session, clears the cookie, and the token stops working", async () => {
    await createUser();
    const { refreshCookie } = await loginAs(app);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshCookie);
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"][0]).toMatch(/^refresh_token=;/);

    expect((await refreshWith(app, refreshCookie)).status).toBe(401);
    expect(await Session.countDocuments({ revokedReason: "logout" })).toBe(1);
  });

  it("is idempotent: logging out twice, or with no cookie, still succeeds", async () => {
    await createUser();
    const { refreshCookie } = await loginAs(app);
    const out = () =>
      request(app).post("/api/v1/auth/logout").set("Cookie", refreshCookie);

    expect((await out()).status).toBe(200);
    expect((await out()).status).toBe(200);
    expect((await request(app).post("/api/v1/auth/logout")).status).toBe(200);
  });

  it("logout-all signs out every device", async () => {
    await createUser();
    const phone = await loginAs(app);
    const laptop = await loginAs(app);

    const res = await request(app)
      .post("/api/v1/auth/logout-all")
      .set(bearer(phone.accessToken));
    expect(res.status).toBe(200);

    expect((await refreshWith(app, phone.refreshCookie)).status).toBe(401);
    expect((await refreshWith(app, laptop.refreshCookie)).status).toBe(401);
  });
});
