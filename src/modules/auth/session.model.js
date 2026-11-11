import mongoose from "mongoose";

export const REVOKE_REASONS = Object.freeze({
  ROTATED: "rotated",
  LOGOUT: "logout",
  LOGOUT_ALL: "logout_all",
  REUSE_DETECTED: "reuse_detected",
  PASSWORD_CHANGE: "password_change",
  PASSWORD_RESET: "password_reset",
  USER_INACTIVE: "user_inactive",
  SESSION_EXPIRED: "session_expired",
});

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // One family per login; every rotated refresh token shares it
    familyId: { type: String, required: true },
    // When the family began. Caps total session life however often it is refreshed
    familyStartedAt: { type: Date, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, enum: Object.values(REVOKE_REASONS) },
    ip: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

sessionSchema.index({ familyId: 1 });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // cleanup only

export const Session = mongoose.model("Session", sessionSchema);
