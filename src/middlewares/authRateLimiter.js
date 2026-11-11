import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

function createLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Route rejections through the error handler so they use the standard envelope
    handler: (_req, _res, next) =>
      next(
        new ApiError(429, "Too many attempts. Try again later.", {
          code: "RATE_LIMITED",
        }),
      ),
  });
}

// Credential-sensitive endpoints: login, register, password reset, password change
export const authRateLimiter = createLimiter(10);

// Legitimate clients refresh regularly, so this one is looser
export const refreshRateLimiter = createLimiter(60);
