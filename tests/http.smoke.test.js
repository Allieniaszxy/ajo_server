import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

// Nothing here touches the database, so these run anywhere, instantly.

describe("HTTP layer", () => {
  it("answers the liveness check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("reports not ready while the database is disconnected", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
  });

  it("returns the standard error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MALFORMED_JSON");
  });

  it("rejects oversized bodies", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it("lists every validation problem at once", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(["fullName", "email", "password"]),
    );
  });

  it("refuses privileged fields on registration", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "Ada Obi",
      email: "ada@example.com",
      password: "correct-horse-9",
      platformRole: "platform_admin",
    });
    expect(res.status).toBe(400);
  });

  it("marks auth responses as uncacheable", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("protects every /users route", async () => {
    for (const [method, path] of [
      ["get", "/api/v1/users/me"],
      ["patch", "/api/v1/users/me"],
      ["post", "/api/v1/users/me/change-password"],
    ]) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("protects logout-all", async () => {
    const res = await request(app).post("/api/v1/auth/logout-all");
    expect(res.status).toBe(401);
  });

  it("refresh without a cookie fails and clears the cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    expect(res.headers["set-cookie"][0]).toMatch(/^refresh_token=;/);
  });

  it("refresh and logout refuse a foreign Origin", async () => {
    for (const path of ["/api/v1/auth/refresh", "/api/v1/auth/logout"]) {
      const res = await request(app)
        .post(path)
        .set("Origin", "https://evil.example");
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe("UNTRUSTED_ORIGIN");
    }
  });
});
