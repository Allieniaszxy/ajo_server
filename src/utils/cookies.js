import { env } from "../config/env.js";

export const REFRESH_COOKIE = "refresh_token";

// The browser only sends this cookie to the auth endpoints, never to the rest of the API
const base = {
  httpOnly: true, // JavaScript can't read it, which limits the damage of an XSS bug
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
};

export const setRefreshCookie = (res, token, expiresAt) =>
  res.cookie(REFRESH_COOKIE, token, { ...base, expires: expiresAt });

export const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, base);
