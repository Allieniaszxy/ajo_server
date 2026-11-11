import { Router } from "express";
import {
  authRateLimiter,
  refreshRateLimiter,
} from "../../middlewares/authRateLimiter.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireTrustedOrigin } from "../../middlewares/requireTrustedOrigin.js";
import { validate } from "../../middlewares/validate.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation.js";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  logoutAllController,
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
} from "./auth.controller.js";

export const authRouter = Router();

// Responses here carry tokens, so no cache or proxy may store them
authRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Cheapest checks first: rate limit, then validation, then the controller
authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  registerController,
);
authRouter.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  loginController,
);

// Cookie-authenticated: the browser sends the refresh cookie automatically,
// so the Origin is checked as well
authRouter.post(
  "/refresh",
  requireTrustedOrigin,
  refreshRateLimiter,
  refreshController,
);
authRouter.post("/logout", requireTrustedOrigin, logoutController);

authRouter.post("/logout-all", authenticate, logoutAllController);

authRouter.post(
  "/verify-email",
  authRateLimiter,
  validate(verifyEmailSchema),
  verifyEmailController,
);
authRouter.post(
  "/resend-verification",
  authRateLimiter,
  validate(resendVerificationSchema),
  resendVerificationController,
);
authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);
authRouter.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);
