import request from "supertest";

const DEFAULTS = { email: "ada@example.com", password: "correct-horse-9" };

/** The "refresh_token=<value>" part of a Set-Cookie header, or undefined. */
export function refreshCookieFrom(res) {
  const header = (res.headers["set-cookie"] ?? []).find((c) =>
    c.startsWith("refresh_token="),
  );
  return header?.split(";")[0];
}

/** Logs in through the real endpoint and returns what a browser would hold. */
export async function loginAs(app, creds = {}) {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ ...DEFAULTS, ...creds });
  return {
    res,
    accessToken: res.body?.data?.accessToken,
    refreshCookie: refreshCookieFrom(res),
  };
}

export const refreshWith = (app, cookie) =>
  request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
