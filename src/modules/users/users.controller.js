import { toPublicUser } from "./user.mapper.js";
import { updateProfile, changePassword } from "./users.service.js";

// req.user and req.auth are set by the authenticate middleware

export function getMeController(req, res) {
  res.json({ success: true, data: { user: toPublicUser(req.user) } });
}

export async function updateProfileController(req, res) {
  const user = await updateProfile(req.user._id, req.validated.body);
  res.json({ success: true, data: { user } });
}

export async function changePasswordController(req, res) {
  await changePassword(req.user._id, req.auth.sessionId, req.validated.body);
  res.json({
    success: true,
    message: "Password changed. Your other devices have been signed out.",
  });
}
