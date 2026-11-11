import crypto from "node:crypto";

/** URL-safe random token for email verification, password reset and refresh tokens */
export function randomToken(bytes = 32) {
  // Guard against accidentally generating a weak token
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new RangeError("Token must be at least 16 bytes");
  }
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Tokens are stored hashed, so a database leak never exposes live tokens.
 * SHA-256 is right here because the input is 256 bits of randomness.
 * Passwords are low-entropy and use argon2id instead.
 */
export function hashToken(token) {
  // Fail loudly on bad input instead of hashing the string "undefined"
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("Token must be a non-empty string");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}
