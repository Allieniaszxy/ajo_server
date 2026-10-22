import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  // Number of proxies in front of the app (0 locally, 1 behind Nginx)
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Normalised to an origin, so a trailing slash can't break CORS
  CLIENT_URL: z.url().transform((v) => new URL(v).origin),
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // The logger depends on env, so console is the right tool here
  console.error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  );
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
