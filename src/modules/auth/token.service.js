import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { Session } from "./session.model.js";
import { randomToken, hashToken } from "../../utils/crypto.js";
import { parseDuration } from "../../utils/duration.js";

const ISSUER = "ajo-api";

export function signAccessToken({ userId, role, familyId }) {
  return jwt.sign({ role, sid: familyId }, env.JWT_ACCESS_SECRET, {
    subject: String(userId),
    expiresIn: env.ACCESS_TOKEN_TTL,
    algorithm: "HS256", // pinned, never taken from the token itself
    issuer: ISSUER,
  });
}

/** Throws on a bad or expired token (mapped to 401 by the error handler). */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
  });
}

/**
 * Starts a new session family (login) or continues one (refresh). Returns the RAW token.
 * A token never outlives its family's SESSION_MAX_AGE.
 */
export async function createRefreshSession({
  userId,
  familyId = randomUUID(),
  familyStartedAt = new Date(),
  meta = {},
}) {
  const refreshToken = randomToken(48);
  const expiresAt = new Date(
    Math.min(
      Date.now() + parseDuration(env.REFRESH_TOKEN_TTL),
      familyStartedAt.getTime() + parseDuration(env.SESSION_MAX_AGE),
    ),
  );

  await Session.create({
    userId,
    familyId,
    familyStartedAt,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300),
  });

  return { refreshToken, familyId, expiresAt };
}
