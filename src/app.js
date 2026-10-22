import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

// Behind Nginx this must be 1, or req.ip is always the proxy's address
app.set("trust proxy", env.TRUST_PROXY);
app.disable("x-powered-by");

// Health checks come first so they skip logging and rate limiting
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});
app.get("/health/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(compression());

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = req.headers["x-request-id"] ?? randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  }),
);

// NOTE: this store is in memory and per instance. With N instances behind a
// load balancer the effective limit is N x 300. We'll move it to shared storage later.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

// app.use('/api/v1', routes);   // mounted in Phase 2

app.use(notFound);
app.use(errorHandler);
