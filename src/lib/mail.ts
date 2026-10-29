import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Minimal email sender (SRS section 36: in-system plus email notifications).
 * Configure SMTP_* in .env.local. Without them nothing is sent and the message is logged instead,
 * so the app keeps working in development. It never throws: a failed email must not fail the action that triggered it.
 */
let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  transporter = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

export async function sendMail(input: { to: string | string[]; subject: string; text: string }): Promise<boolean> {
  const t = getTransporter();
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (!to.length) return false;
  if (!t) {
    console.info(`[mail not configured] To: ${to.join(", ")} | ${input.subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: input.subject, text: input.text });
    return true;
  } catch (err) {
    console.error("email failed", err);
    return false;
  }
}
