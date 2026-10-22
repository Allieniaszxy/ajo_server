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
