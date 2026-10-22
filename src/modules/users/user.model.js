import mongoose from "mongoose";

export const PLATFORM_ROLES = Object.freeze({
  USER: "user",
  PLATFORM_ADMIN: "platform_admin",
});

export const USER_STATUS = Object.freeze({
  PENDING_VERIFICATION: "pending_verification",
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // Optional. Unique only among users who have one (sparse)
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      unique: true,
      sparse: true,
    },

    // Never returned by default; the login service asks for it explicitly
    passwordHash: { type: String, required: true, select: false },

    platformRole: {
      type: String,
      enum: Object.values(PLATFORM_ROLES),
      default: PLATFORM_ROLES.USER,
    },

    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING_VERIFICATION,
    },

    emailVerifiedAt: { type: Date },
    lastLoginAt: { type: Date },

    // Support for login lockout (Phase 2, step 4)
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash; // defence in depth
        return ret;
      },
    },
  },
);

export const User = mongoose.model("User", userSchema);
