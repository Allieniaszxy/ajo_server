import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  // Never let credentials reach the logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
    },
  }),
});
