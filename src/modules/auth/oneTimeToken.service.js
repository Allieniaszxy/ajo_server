import { OneTimeToken, TOKEN_TYPES } from "./oneTimeToken.model.js";
import { randomToken, hashToken } from "../../utils/crypto.js";
import { ApiError } from "../../utils/ApiError.js";

// Reset links are far more dangerous if stolen, so they live much shorter
const TTL_MS = Object.freeze({
  [TOKEN_TYPES.EMAIL_VERIFY]: 24 * 60 * 60 * 1000,
  [TOKEN_TYPES.PASSWORD_RESET]: 30 * 60 * 1000,
});

const invalidToken = () =>
  ApiError.badRequest("Invalid or expired link", { code: "INVALID_TOKEN" });

/** Returns the RAW token, the only moment it exists in plain form. */
export async function issueToken(userId, type, { session } = {}) {
  const ttl = TTL_MS[type];
  if (!ttl) throw new Error(`Unknown token type: ${type}`);

  // Only the newest link should work
  await OneTimeToken.deleteMany({ userId, type, usedAt: null }, { session });

  const rawToken = randomToken();
  await OneTimeToken.create(
    [
      {
        userId,
        type,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttl),
      },
    ],
    { session },
  );
  return rawToken;
}

/**
 * Atomically validates and burns a token. Check and mark-as-used happen in one
 * operation, so two simultaneous requests can't both succeed.
 * Every failure reason returns the same error, so attackers learn nothing.
 */
export async function consumeToken(rawToken, type, { session } = {}) {
  if (typeof rawToken !== "string" || rawToken.length === 0)
    throw invalidToken();

  const doc = await OneTimeToken.findOneAndUpdate(
    {
      tokenHash: hashToken(rawToken),
      type,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true, session },
  );
  if (!doc) throw invalidToken();

  return doc.userId;
}
