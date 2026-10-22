import mongoose from "mongoose";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export const notFound = (req, _res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// Turns known failure types into ApiError; returns null for genuine bugs
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return new ApiError(400, "Validation failed", {
      code: "VALIDATION_ERROR",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return new ApiError(400, "Validation failed", {
      code: "VALIDATION_ERROR",
      details: Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`, {
      code: "INVALID_VALUE",
    });
  }
  if (err?.code === 11000) {
    return ApiError.conflict("Duplicate value", {
      code: "DUPLICATE_KEY",
      details: Object.keys(err.keyValue ?? {}),
    });
  }
  if (err?.name === "TokenExpiredError") {
    return ApiError.unauthorized("Token expired", { code: "TOKEN_EXPIRED" });
  }
  if (err?.name === "JsonWebTokenError") {
    return ApiError.unauthorized("Invalid token", { code: "INVALID_TOKEN" });
  }
  if (err?.type === "entity.parse.failed") {
    return ApiError.badRequest("Malformed JSON body", {
      code: "MALFORMED_JSON",
    });
  }
  if (err?.type === "entity.too.large") {
    return new ApiError(413, "Payload too large", {
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  return null;
}

// Express identifies error middleware by its four arguments
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const known = normalize(err);
  const apiError =
    known ??
    new ApiError(500, "Internal server error", {
      code: "INTERNAL_ERROR",
      isOperational: false,
    });

  const log = req.log ?? logger;
  if (!known) log.error({ err }, "Unhandled error");

  res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && { details: apiError.details }),
      requestId: req.id,
      ...(env.NODE_ENV === "development" && !known && { stack: err?.stack }),
    },
  });
};
