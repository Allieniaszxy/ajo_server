import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authRateLimiter } from "../../middlewares/authRateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "./users.validation.js";
import {
  getMeController,
  updateProfileController,
  changePasswordController,
} from "./users.controller.js";

export const usersRouter = Router();

// Personal data: never cache, and everything here needs a logged-in user
usersRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
usersRouter.use(authenticate);

usersRouter.get("/me", getMeController);
usersRouter.patch(
  "/me",
  validate(updateProfileSchema),
  updateProfileController,
);
usersRouter.post(
  "/me/change-password",
  authRateLimiter,
  validate(changePasswordSchema),
  changePasswordController,
);
