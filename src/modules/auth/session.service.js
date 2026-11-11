import { Session } from "./session.model.js";

/** Revokes every live token in one login's family. Safe to call twice. */
export function revokeFamily(familyId, reason) {
  return Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Revokes all of a user's logins, optionally keeping one (e.g. the current device). */
export function revokeUserSessions(
  userId,
  reason,
  { exceptFamilyId, session } = {},
) {
  const filter = { userId, revokedAt: null };
  if (exceptFamilyId) filter.familyId = { $ne: exceptFamilyId };
  return Session.updateMany(
    filter,
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { session },
  );
}
