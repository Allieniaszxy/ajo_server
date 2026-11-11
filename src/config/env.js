import { z } from "zod";

// Empty values in .env ("SMTP_HOST=") count as "not set"
const blankToUndefined = (v) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const duration = (example) =>
  z.string().regex(/^\d+[smhd]$/, `e.g. ${example}`);

const schema = z
  .object({
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
    ACCESS_TOKEN_TTL: duration("15m").default("15m"),
    REFRESH_TOKEN_TTL: duration("7d").default("7d"),
    // Hard cap on one login's lifetime, however often it is refreshed
    SESSION_MAX_AGE: duration("30d").default("30d"),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    // Email. Leave SMTP_HOST unset in development and links are logged instead
    SMTP_HOST: optionalString,
    SMTP_PORT: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().positive().default(587),
    ),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: z.preprocess(
      blankToUndefined,
      z.string().default("Ajo <no-reply@ajo.local>"),
    ),

    PAYSTACK_SECRET_KEY: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "must differ from JWT_ACCESS_SECRET",
      });
    }
    if (v.NODE_ENV === "production" && !v.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "is required in production",
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const message = `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`;
  // In tests, throw so the failure shows up in the test report
  if (process.env.NODE_ENV === "test") throw new Error(message);
  console.error(message);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
