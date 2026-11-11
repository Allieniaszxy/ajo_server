import argon2 from "argon2";
import { logger } from "../../config/logger.js";
import { ApiError } from "../../utils/ApiError.js";
import { mapDuplicateKey } from "../../utils/duplicateKey.js";
import { User } from "./user.model.js";
import { toPublicUser } from "./user.mapper.js";
import { REVOKE_REASONS } from "../auth/session.model.js";
import { revokeUserSessions } from "../auth/session.service.js";
import { sendPasswordChangedEmail } from "../auth/auth.mailer.js";

export async function updateProfile(userId, { fullName, phone }) {
  const $set = {};
  const $unset = {};
  if (fullName !== undefined) $set.fullName = fullName;
  if (phone === null)
    $unset.phone = ""; // remove the number
  else if (phone !== undefined) $set.phone = phone;

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;

  try {
    const user = await User.findByIdAndUpdate(userId, update, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!user) throw ApiError.notFound("User not found");
    return toPublicUser(user);
  } catch (err) {
    throw mapDuplicateKey(err);
  }
}

/**
 * Needs the current password even though the caller is logged in, because a
 * stolen access token alone must not be enough to take over the account.
 * Every OTHER device is signed out; the current one stays.
 */
export async function changePassword(
  userId,
  currentSessionId,
  { currentPassword, newPassword },
) {
  const user = await User.findById(userId).select("+passwordHash email");
  if (!user) throw ApiError.notFound("User not found");

  if (!(await argon2.verify(user.passwordHash, currentPassword))) {
    // 400, not 401: a 401 would make the frontend think the session expired
    throw ApiError.badRequest("Current password is incorrect", {
      code: "INCORRECT_PASSWORD",
    });
  }

  const passwordHash = await argon2.hash(newPassword);
  await User.updateOne({ _id: userId }, { $set: { passwordHash } });
  await revokeUserSessions(userId, REVOKE_REASONS.PASSWORD_CHANGE, {
    exceptFamilyId: currentSessionId,
  });

  sendPasswordChangedEmail(user.email).catch((err) =>
    logger.error({ err, userId }, "Failed to send password changed email"),
  );
}
