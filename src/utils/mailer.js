import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

let transporter;

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/** The only file that knows how mail is delivered. */
export async function sendMail({ to, subject, text }) {
  if (env.SMTP_HOST) {
    await getTransporter().sendMail({ from: env.MAIL_FROM, to, subject, text });
    return;
  }
  // Without SMTP configured, emails are only logged (development and tests).
  // env.js refuses to start in production without SMTP_HOST.
  logger.info(
    { to, subject, text },
    "[dev] email not sent (SMTP_HOST is not set)",
  );
}
