import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export async function sendMail({ to, subject, text }) {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Mailer not configured: cannot send email in production yet",
    );
  }
  // Dev/test stand-in. Replace this body with a Nodemailer transport later.
  logger.info({ to, subject, text }, "[dev] email not sent");
}
