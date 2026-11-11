import { z } from "zod";

// Normalise first, then validate. Trimming after z.email() would reject
// " ada@example.com " before it ever got cleaned.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

// Never trim passwords: spaces are legitimate characters.
// The upper limit stops huge inputs from burning CPU in argon2.
export const newPasswordField = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters");

// Login shouldn't reveal the password policy, so only a cap applies
export const anyPasswordField = z.string().min(1).max(128);

const stripSeparators = (v) => v.replace(/[\s-]/g, "");
const phonePattern = z.string().regex(/^\+?\d{7,15}$/, "Invalid phone number");
const phoneString = z
  .string()
  .trim()
  .transform(stripSeparators)
  .pipe(phonePattern);

// Optional on registration. '' becomes undefined so it is never stored (the sparse
// unique index only ignores *missing* fields, not empty strings).
export const optionalPhoneField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  phoneString.optional(),
);

// On profile updates: '' or null removes the number, a value replaces it
export const phoneUpdateField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  phoneString.nullable().optional(),
);

export const fullNameField = z.string().trim().min(2).max(100);

// One-time tokens (email verification, password reset)
export const tokenField = z.string().min(20).max(200);
