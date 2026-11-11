import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Defence in depth for cookie-authenticated endpoints (refresh, logout).
 * Browsers always send Origin on cross-site POSTs. Requests without it
 * (curl, server-to-server, tests) are allowed: they can't ride a victim's cookies.
 */
export function requireTrustedOrigin(req, _res, next) {
  const origin = req.get("origin");
  if (origin && origin !== env.CLIENT_URL) {
    return next(
      ApiError.forbidden("Untrusted origin", { code: "UNTRUSTED_ORIGIN" }),
    );
  }
  next();
}
