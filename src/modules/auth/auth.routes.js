import { Router } from "express";
import { authRateLimiter } from "../../middlewares/authRateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import { registerSchema } from "./auth.validation.js";
import { registerController } from "./auth.controller.js";

export const authRouter = Router();

// Cheapest checks first: rate limit, then validation, then the controller
authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  registerController,
);
