import argon2 from "argon2";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashToken } from "../../utils/crypto.js";
import { parseDuration } from "../../utils/duration.js";
import { mapDuplicateKey } from "../../utils/duplicateKey.js";
import { User, USER_STATUS } from "../users/user.model.js";
import { toPublicUser } from "../users/user.mapper.js";
import { TOKEN_TYPES } from "./oneTimeToken.model.js";
import { issueToken, consumeToken } from "./oneTimeToken.service.js";
import { Session, REVOKE_REASONS } from "./session.model.js";
import { revokeFamily, revokeUserSessions } from "./session.service.js";
import { createRefreshSession, signAccessToken } from "./token.service.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from "./auth.mailer.js";

// ---------------------------------------------------------------- helpers

// Fire-and-forget email. A mail failure must never fail the request, and an
// unhandled rejection would shut the server down, so it always has a catch.
function sendInBackground(promise, what, userId) {
  promise.catch((err) =>
    logger.error({ err, userId }, `Failed to send ${what} email`),
  );
}

// ---------------------------------------------------------------- register

export async function register({ fullName, email, phone, password }) {
  // argon2 defaults to argon2id
  const passwordHash = await argon2.hash(password);

  const session = await mongoose.startSession();
  let user;
  let rawToken;
  try {
    // User and token are created together or not at all.
    // withTransaction can re-run this callback after a transient error,
    // so keep it free of side effects beyond database writes.
    await session.withTransaction(async () => {
      [user] = await User.create([{ fullName, email, phone, passwordHash }], {
        session,
      });
      rawToken = await issueToken(user._id, TOKEN_TYPES.EMAIL_VERIFY, {
        session,
      });
    });
  } catch (err) {
    throw mapDuplicateKey(err);
  } finally {
    await session.endSession();
  }

  // After commit
  sendInBackground(
    sendVerificationEmail(user.email, rawToken),
    "verification",
    user.id,
  );

  return toPublicUser(user);
}

// ---------------------------------------------------------------- login

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

// Hashed once at startup. Used so a missing account costs the same time as a wrong password.
const DUMMY_HASH = await argon2.hash("ajo-dummy-password-for-timing");

const invalidCredentials = () =>
  ApiError.unauthorized("Invalid email or password", {
    code: "INVALID_CREDENTIALS",
  });

async function recordFailedAttempt(userId) {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { failedLoginAttempts: 1 } }, // atomic, safe under concurrent attempts
    { returnDocument: "after" },
  );
  if (updated && updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          lockUntil: new Date(Date.now() + LOCK_MS),
          failedLoginAttempts: 0,
        },
      },
    );
  }
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user) {
    await argon2.verify(DUMMY_HASH, password); // equalise timing
    throw invalidCredentials();
  }

  // Locked accounts aren't even checked, so the lock can't be used as a password oracle
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(429, "Too many failed attempts. Try again later.", {
      code: "ACCOUNT_LOCKED",
    });
  }

  if (!(await argon2.verify(user.passwordHash, password))) {
    await recordFailedAttempt(user._id);
    throw invalidCredentials();
  }

  // Status is checked only AFTER the password, so it isn't leaked to strangers
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden("This account is suspended", {
      code: "ACCOUNT_SUSPENDED",
    });
  }
  if (user.status === USER_STATUS.PENDING_VERIFICATION) {
    throw ApiError.forbidden("Verify your email before logging in", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const $set = { failedLoginAttempts: 0, lastLoginAt: new Date() };
  // Upgrade the stored hash if the argon2 defaults have been strengthened since
  if (argon2.needsRehash(user.passwordHash))
    $set.passwordHash = await argon2.hash(password);
  await User.updateOne({ _id: user._id }, { $set, $unset: { lockUntil: "" } });

  const { refreshToken, familyId, expiresAt } = await createRefreshSession({
    userId: user._id,
    meta,
  });
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.platformRole,
    familyId,
  });

  return { user: toPublicUser(user), accessToken, refreshToken, expiresAt };
}

// ---------------------------------------------------------------- refresh / logout

// A refresh token that was rotated moments ago is usually two browser tabs racing,
// not theft. Inside this window the loser is rejected without punishing the session.
const REUSE_GRACE_MS = 10_000;

const invalidRefresh = () =>
  ApiError.unauthorized("Session expired. Please log in again.", {
    code: "INVALID_REFRESH_TOKEN",
  });

/**
 * Exchanges a refresh token for a new access token AND a new refresh token.
 * Each refresh token works exactly once. Presenting an old one again is treated
 * as theft and revokes the whole session family.
 */
export async function refresh(rawToken, meta) {
  if (typeof rawToken !== "string" || rawToken.length === 0)
    throw invalidRefresh();

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  // Check and burn in one atomic step, so of two concurrent requests only one wins
  const current = await Session.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: REVOKE_REASONS.ROTATED } },
    { returnDocument: "after" },
  );

  if (!current) {
    const known = await Session.findOne({ tokenHash });
    const rotated = known?.revokedReason === REVOKE_REASONS.ROTATED;
    if (rotated && now - known.revokedAt >= REUSE_GRACE_MS) {
      await revokeFamily(known.familyId, REVOKE_REASONS.REUSE_DETECTED);
      logger.warn(
        { userId: known.userId, familyId: known.familyId },
        "Refresh token reuse detected; session family revoked",
      );
    }
    throw invalidRefresh();
  }

  const user = await User.findById(current.userId);
  const familyExpired =
    current.familyStartedAt.getTime() + parseDuration(env.SESSION_MAX_AGE) <=
    Date.now();

  if (!user || user.status !== USER_STATUS.ACTIVE || familyExpired) {
    const reason = familyExpired
      ? REVOKE_REASONS.SESSION_EXPIRED
      : REVOKE_REASONS.USER_INACTIVE;
    await revokeFamily(current.familyId, reason);
    // The token we just burned was labelled "rotated"; record the real reason instead
    await Session.updateOne(
      { _id: current._id },
      { $set: { revokedReason: reason } },
    );
    throw invalidRefresh();
  }

  const { refreshToken, familyId, expiresAt } = await createRefreshSession({
    userId: user._id,
    familyId: current.familyId,
    familyStartedAt: current.familyStartedAt,
    meta,
  });
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.platformRole,
    familyId,
  });

  return { user: toPublicUser(user), accessToken, refreshToken, expiresAt };
}

/** Revokes the login the token belongs to. Always succeeds, so logging out is idempotent. */
export async function logout(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length === 0) return;
  const session = await Session.findOne({ tokenHash: hashToken(rawToken) });
  if (session) await revokeFamily(session.familyId, REVOKE_REASONS.LOGOUT);
}

export async function logoutAll(userId) {
  await revokeUserSessions(userId, REVOKE_REASONS.LOGOUT_ALL);
}

// ---------------------------------------------------------------- email verification

export async function verifyEmail(rawToken) {
  const session = await mongoose.startSession();
  try {
    // Burn the token and activate the user together, or neither
    await session.withTransaction(async () => {
      const userId = await consumeToken(rawToken, TOKEN_TYPES.EMAIL_VERIFY, {
        session,
      });
      // The status filter stops a suspended user being reactivated by an old link
      await User.updateOne(
        { _id: userId, status: USER_STATUS.PENDING_VERIFICATION },
        { $set: { status: USER_STATUS.ACTIVE, emailVerifiedAt: new Date() } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function resendVerification(email) {
  const user = await User.findOne({
    email,
    status: USER_STATUS.PENDING_VERIFICATION,
  });
  if (!user) return; // the caller responds identically either way

  const rawToken = await issueToken(user._id, TOKEN_TYPES.EMAIL_VERIFY);
  sendInBackground(
    sendVerificationEmail(user.email, rawToken),
    "verification",
    user.id,
  );
}

// ---------------------------------------------------------------- password reset

export async function forgotPassword(email) {
  const user = await User.findOne({ email, status: USER_STATUS.ACTIVE });
  if (!user) return; // the caller responds identically either way

  const rawToken = await issueToken(user._id, TOKEN_TYPES.PASSWORD_RESET);
  sendInBackground(
    sendPasswordResetEmail(user.email, rawToken),
    "password reset",
    user.id,
  );
}

export async function resetPassword({ token, password }) {
  const passwordHash = await argon2.hash(password);

  const session = await mongoose.startSession();
  let userId;
  try {
    await session.withTransaction(async () => {
      userId = await consumeToken(token, TOKEN_TYPES.PASSWORD_RESET, {
        session,
      });
      await User.updateOne(
        { _id: userId },
        // A successful reset also clears any login lockout
        {
          $set: { passwordHash, failedLoginAttempts: 0 },
          $unset: { lockUntil: "" },
        },
        { session },
      );
      // Whoever knew the old password (or stole a session) is signed out everywhere
      await revokeUserSessions(userId, REVOKE_REASONS.PASSWORD_RESET, {
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  const user = await User.findById(userId).select("email");
  if (user)
    sendInBackground(
      sendPasswordChangedEmail(user.email),
      "password changed",
      user.id,
    );
}
