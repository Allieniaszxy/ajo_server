import crypto from 'node:crypto';

/** URL-safe random token for email verification / password reset */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Tokens are stored hashed, so a DB leak never exposes live tokens */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}