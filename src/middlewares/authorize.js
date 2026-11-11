import { ApiError } from "../utils/ApiError.js";

/** Use after authenticate: requirePlatformRole("platform_admin") */
export const requirePlatformRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.platformRole))
      return next(ApiError.forbidden());
    next();
  };
