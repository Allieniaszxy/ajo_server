import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 10,
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
