import { ApiError } from "./ApiError.js";

/**
 * Turns a MongoDB duplicate-key error into a friendly 409. Anything else passes through.
 * Trade-off (note it in your report): this reveals that an email or phone is registered.
 */
export function mapDuplicateKey(err) {
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
