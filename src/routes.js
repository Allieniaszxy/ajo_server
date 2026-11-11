import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const routes = Router();
routes.use("/auth", authRouter);
routes.use("/users", usersRouter);
