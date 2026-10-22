import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";

export const routes = Router();
routes.use("/auth", authRouter);
