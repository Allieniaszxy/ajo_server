import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { authenticate } from "../src/middlewares/authenticate.js";
import { requirePlatformRole } from "../src/middlewares/authorize.js";
import { requireTrustedOrigin } from "../src/middlewares/requireTrustedOrigin.js";

const fakeReq = (headers = {}, extra = {}) => ({
  get: (name) => headers[name.toLowerCase()],
  ...extra,
});

// Same secret vitest.config.js gives the app
const SECRET = "a".repeat(64);
const claims = { role: "user", sid: "family-1" };
const signOpts = {
  subject: "64b000000000000000000001",
  algorithm: "HS256",
  issuer: "ajo-api",
};

describe("authenticate (failures that never reach the database)", () => {
  it("requires an Authorization header", async () => {
    await expect(authenticate(fakeReq(), {}, vi.fn())).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_REQUIRED",
    });
  });

  it("requires the Bearer scheme", async () => {
    const req = fakeReq({ authorization: "Basic abc123" });
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("rejects a malformed token", async () => {
    const req = fakeReq({ authorization: "Bearer not-a-jwt" });
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({
      name: "JsonWebTokenError",
    });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign(claims, "x".repeat(64), {
      ...signOpts,
      expiresIn: "15m",
    });
    const req = fakeReq({ authorization: `Bearer ${token}` });
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({
      name: "JsonWebTokenError",
    });
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ ...claims, sub: signOpts.subject, iss: "ajo-api" }),
    ).toString("base64url");
    const req = fakeReq({ authorization: `Bearer ${header}.${body}.` });
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({
      name: "JsonWebTokenError",
    });
  });

  it("rejects an expired token", async () => {
    const token = jwt.sign(
      { ...claims, exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
      signOpts,
    );
    const req = fakeReq({ authorization: `Bearer ${token}` });
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({
      name: "TokenExpiredError",
    });
  });
});

describe("requirePlatformRole", () => {
  const run = (user) => {
    const next = vi.fn();
    requirePlatformRole("platform_admin")({ user }, {}, next);
    return next.mock.calls[0][0];
  };

  it("lets the right role through", () => {
    expect(run({ platformRole: "platform_admin" })).toBeUndefined();
  });

  it("blocks other roles and missing users", () => {
    expect(run({ platformRole: "user" })).toMatchObject({ statusCode: 403 });
    expect(run(undefined)).toMatchObject({ statusCode: 403 });
  });
});

describe("requireTrustedOrigin", () => {
  const run = (origin) => {
    const next = vi.fn();
    requireTrustedOrigin(fakeReq(origin ? { origin } : {}), {}, next);
    return next.mock.calls[0][0];
  };

  it("allows the configured client and requests without an Origin", () => {
    expect(run("http://localhost:5173")).toBeUndefined();
    expect(run(undefined)).toBeUndefined();
  });

  it("blocks any other origin", () => {
    expect(run("https://evil.example")).toMatchObject({
      statusCode: 403,
      code: "UNTRUSTED_ORIGIN",
    });
  });
});
