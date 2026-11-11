import { z } from "zod";
import {
  emailField,
  newPasswordField,
  anyPasswordField,
  optionalPhoneField,
  fullNameField,
  tokenField,
} from "../../utils/validators.js";

export const registerSchema = {
  // strictObject rejects unknown keys, which blocks mass assignment
  // (e.g. someone sending "platformRole": "platform_admin")
  body: z.strictObject({
    fullName: fullNameField,
    email: emailField,
    phone: optionalPhoneField,
    password: newPasswordField,
  }),
};

export const loginSchema = {
  body: z.strictObject({ email: emailField, password: anyPasswordField }),
};

export const verifyEmailSchema = {
  body: z.strictObject({ token: tokenField }),
};

export const resendVerificationSchema = {
  body: z.strictObject({ email: emailField }),
};

export const forgotPasswordSchema = {
  body: z.strictObject({ email: emailField }),
};

export const resetPasswordSchema = {
  body: z.strictObject({ token: tokenField, password: newPasswordField }),
};
