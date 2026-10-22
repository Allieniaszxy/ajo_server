export class ApiError extends Error {
  constructor(
    statusCode,
    message,
    { code = "ERROR", details, isOperational = true } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code; // machine-readable, e.g. 'INSUFFICIENT_BALANCE'
    this.details = details; // optional extra info, e.g. field errors
    this.isOperational = isOperational; // expected failure vs. a bug
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = "Bad request", opts = {}) {
    return new ApiError(400, message, { code: "BAD_REQUEST", ...opts });
  }
  static unauthorized(message = "Authentication required", opts = {}) {
    return new ApiError(401, message, { code: "UNAUTHORIZED", ...opts });
  }
  static forbidden(message = "You do not have permission", opts = {}) {
    return new ApiError(403, message, { code: "FORBIDDEN", ...opts });
  }
  static notFound(message = "Resource not found", opts = {}) {
    return new ApiError(404, message, { code: "NOT_FOUND", ...opts });
  }
  static conflict(message = "Conflict", opts = {}) {
    return new ApiError(409, message, { code: "CONFLICT", ...opts });
  }
  static unprocessable(message = "Unprocessable request", opts = {}) {
    return new ApiError(422, message, { code: "UNPROCESSABLE", ...opts });
  }
}
