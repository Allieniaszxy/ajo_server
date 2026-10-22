import { z } from "zod";

// Normalise first, then validate. Trimming after z.email() would reject
// " ada@example.com " before it ever got cleaned.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// Never trim passwords: spaces are legitimate characters.
// The upper limit stops huge inputs from burning CPU in argon2.
const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128);

// Optional. '' becomes undefined so it is never stored (the sparse unique index
// only ignores *missing* fields, not empty strings).
const phone = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{7,15}$/, "Invalid phone number"))
    .optional(),
);

export const registerSchema = {
  // strictObject rejects unknown keys, which blocks mass assignment
  // (e.g. someone sending "platformRole": "platform_admin")
  body: z.strictObject({
    fullName: z.string().trim().min(2).max(100),
    email,
    phone,
    password,
  }),
};

export const loginSchema = {
  body: z.strictObject({
    email,
    // No length rules here beyond the cap: login shouldn't reveal the password policy
    password: z.string().min(1).max(128),
  }),
};
