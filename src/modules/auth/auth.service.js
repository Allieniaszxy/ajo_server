import argon2 from "argon2";
import mongoose from "mongoose";
import { User } from "../users/user.model.js";
import { toPublicUser } from "../users/user.mapper.js";
import { TOKEN_TYPES } from "./oneTimeToken.model.js";
import { issueToken } from "./oneTimeToken.service.js";
import { sendVerificationEmail } from "./auth.mailer.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../config/logger.js";

// Turns a duplicate-key error into a friendly 409. Any other error passes through.
// Trade-off (note it in your report): this reveals that an email is registered.
function mapDuplicateKey(err) {
  if (err?.code !== 11000) return err;
  const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0];
  if (field === "email") {
    return ApiError.conflict("An account with this email already exists", {
      code: "EMAIL_TAKEN",
    });
  }
  if (field === "phone") {
    return ApiError.conflict(
      "An account with this phone number already exists",
      {
        code: "PHONE_TAKEN",
      },
    );
  }
  return err;
}

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

  // After commit. A mail failure must never undo a successful registration,
  // and an unhandled rejection here would shut the server down.
  sendVerificationEmail(user.email, rawToken).catch((err) =>
    logger.error({ err, userId: user.id }, "Failed to send verification email"),
  );

  return toPublicUser(user);
}
