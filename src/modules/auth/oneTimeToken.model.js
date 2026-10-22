import mongoose from "mongoose";

export const TOKEN_TYPES = Object.freeze({
  EMAIL_VERIFY: "email_verify",
  PASSWORD_RESET: "password_reset",
});

const oneTimeTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: Object.values(TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// "Unused tokens of this type for this user" lookups
oneTimeTokenSchema.index({ userId: 1, type: 1 });

// Cleanup only: MongoDB's TTL monitor runs about once a minute, so the
// service must still check expiresAt itself when consuming a token
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OneTimeToken = mongoose.model("OneTimeToken", oneTimeTokenSchema);
