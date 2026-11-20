import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null | undefined;

/**
 * Sends a plain-text email through SMTP_URL. Returns false (never throws) when mail is not configured
 * or the server refuses, so the caller can fall back to showing the link to an officer.
 * shortcut: sent inline with short timeouts; move to a queue if mail volume grows.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  transport ??= process.env.SMTP_URL
    ? nodemailer.createTransport({
        url: process.env.SMTP_URL,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      } as never)
    : null;
  if (!transport) return false;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    return true;
  } catch {
    return false;
  }
}
