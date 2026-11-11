import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "./auth.service.js";
import {
  REFRESH_COOKIE,
  setRefreshCookie,
  clearRefreshCookie,
} from "../../utils/cookies.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed.
// Only ever read req.validated, never raw req.body.

const sessionMeta = (req) => ({ ip: req.ip, userAgent: req.get("user-agent") });

export async function registerController(req, res) {
  const user = await register(req.validated.body);

  res.status(201).json({
    success: true,
    data: { user },
    message: "Account created. Check your email to verify your address.",
  });
}

export async function loginController(req, res) {
  const { user, accessToken, refreshToken, expiresAt } = await login(
    req.validated.body,
    sessionMeta(req),
  );

  setRefreshCookie(res, refreshToken, expiresAt); // the refresh token never appears in the body
  res.json({ success: true, data: { user, accessToken } });
}

export async function refreshController(req, res) {
  try {
    const { user, accessToken, refreshToken, expiresAt } = await refresh(
      req.cookies?.[REFRESH_COOKIE],
      sessionMeta(req),
    );
    setRefreshCookie(res, refreshToken, expiresAt);
    res.json({ success: true, data: { user, accessToken } });
  } catch (err) {
    // A dead token is useless, so remove the cookie instead of resending it forever
    if (err?.code === "INVALID_REFRESH_TOKEN") clearRefreshCookie(res);
    throw err;
  }
}

export async function logoutController(req, res) {
  await logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out." });
}

export async function logoutAllController(req, res) {
  await logoutAll(req.user._id);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out of all devices." });
}

export async function verifyEmailController(req, res) {
  await verifyEmail(req.validated.body.token);
  res.json({ success: true, message: "Email verified. You can now log in." });
}

export async function resendVerificationController(req, res) {
  await resendVerification(req.validated.body.email);
  // Same answer whether or not the account exists
  res.status(202).json({
    success: true,
    message: "If that account needs verification, a new link has been sent.",
  });
}

export async function forgotPasswordController(req, res) {
  await forgotPassword(req.validated.body.email);
  res.status(202).json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}

export async function resetPasswordController(req, res) {
  await resetPassword(req.validated.body);
  res.json({
    success: true,
    message: "Password updated. Please log in with your new password.",
  });
}
