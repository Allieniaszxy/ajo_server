import { env } from "../../config/env.js";
import { sendMail } from "../../utils/mailer.js";

function clientLink(path, token) {
  const url = new URL(path, env.CLIENT_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function sendVerificationEmail(email, rawToken) {
  const link = clientLink("/verify-email", rawToken);
  return sendMail({
    to: email,
    subject: "Verify your Ajo account",
    text: `Welcome to Ajo.\n\nVerify your email: ${link}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this message.`,
  });
}

export function sendPasswordResetEmail(email, rawToken) {
  const link = clientLink("/reset-password", rawToken);
  return sendMail({
    to: email,
    subject: "Reset your Ajo password",
    text: `We received a request to reset your Ajo password.\n\nChoose a new password: ${link}\n\nThis link expires in 30 minutes. If you didn't ask for this, ignore this message and your password stays the same.`,
  });
}

export function sendPasswordChangedEmail(email) {
  return sendMail({
    to: email,
    subject: "Your Ajo password was changed",
    text: "The password on your Ajo account was just changed, and you were signed out of your other devices.\n\nIf this wasn't you, reset your password immediately and contact support.",
  });
}
