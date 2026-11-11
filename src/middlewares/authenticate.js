import { ApiError } from "../utils/ApiError.js";
import { User, USER_STATUS } from "../modules/users/user.model.js";
import { verifyAccessToken } from "../modules/auth/token.service.js";

const authRequired = () =>
  ApiError.unauthorized("Authentication required", { code: "AUTH_REQUIRED" });

/**
 * Requires "Authorization: Bearer <access token>".
 * Sets req.user (full document) and req.auth ({ userId, sessionId, role }).
 *
 * The user is loaded on every request on purpose: suspension and role changes
 * take effect immediately instead of waiting for the token to expire.
 * Token problems (expired, malformed) throw and are mapped by the error handler
 * (TOKEN_EXPIRED / INVALID_TOKEN), which is how the frontend knows to refresh.
 */
export async function authenticate(req, _res, next) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) throw authRequired();

  const claims = verifyAccessToken(token);

  const user = await User.findById(claims.sub);
  if (!user) throw authRequired();
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden("This account is suspended", {
      code: "ACCOUNT_SUSPENDED",
    });
  }
  if (user.status !== USER_STATUS.ACTIVE) throw authRequired();

  req.user = user;
  req.auth = {
    userId: user.id,
    sessionId: claims.sid,
    role: user.platformRole,
  };
  next();
}
