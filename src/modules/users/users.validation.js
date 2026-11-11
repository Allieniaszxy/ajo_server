import { z } from "zod";
import {
  fullNameField,
  phoneUpdateField,
  anyPasswordField,
  newPasswordField,
} from "../../utils/validators.js";

// Email is not editable here: changing it needs its own verification flow.
// strictObject also blocks privileged fields such as platformRole and status.
export const updateProfileSchema = {
  body: z
    .strictObject({
      fullName: fullNameField.optional(),
      phone: phoneUpdateField,
    })
    .refine(
      (v) => Object.keys(v).length > 0,
      "Provide at least one field to update",
    ),
};

export const changePasswordSchema = {
  body: z
    .strictObject({
      currentPassword: anyPasswordField,
      newPassword: newPasswordField,
    })
    .refine((v) => v.currentPassword !== v.newPassword, {
      path: ["newPassword"],
      message: "New password must be different from the current one",
    }),
};
