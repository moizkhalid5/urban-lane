/**
 * Provider-agnostic transactional email.
 *
 * EMAIL_PROVIDER:
 *   "console" (default in dev) — logs the email to the server console.
 *   "resend"  — sends via the Resend HTTP API (set RESEND_API_KEY).
 *   "smtp"    — sends via SMTP (set SMTP_* vars; requires `nodemailer`).
 *
 * Swap providers without touching call sites: see templates in ./templates.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const FROM = process.env.EMAIL_FROM || "Urban Lane <no-reply@urbanelane.com>";

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  }
}

async function sendViaSmtp(msg: EmailMessage): Promise<void> {
  // Lazy, optional import so `nodemailer` is only required when SMTP is actually
  // used. The non-literal specifier keeps it out of static type resolution, so the
  // project type-checks without the optional dependency installed.
  // Enable with: `npm i nodemailer`.
  const moduleName = "nodemailer";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* webpackIgnore: true */ moduleName).catch(() => {
    throw new Error("SMTP provider selected but `nodemailer` is not installed. Run: npm i nodemailer");
  });
  const nodemailer = mod.default ?? mod; // CommonJS package loaded via import()
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    // Hostinger (and most SMTP hosts) reject mail whose From differs from the login mailbox.
    from: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Urban Lane <${process.env.SMTP_USER}>` : FROM),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
  });
}

function logToConsole(msg: EmailMessage): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "\n──────── 📧  EMAIL (console provider) ────────",
      `From:    ${FROM}`,
      `To:      ${msg.to}`,
      `Subject: ${msg.subject}`,
      msg.replyTo ? `Reply-To: ${msg.replyTo}` : "",
      "─────────────────────────────────────────────",
      msg.text || msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      "─────────────────────────────────────────────\n",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/** Send an email through the configured provider. Never throws in console mode. */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  try {
    switch (provider) {
      case "resend":
        return await sendViaResend(msg);
      case "smtp":
        return await sendViaSmtp(msg);
      default:
        return logToConsole(msg);
    }
  } catch (err) {
    // Never let a transactional email failure break a checkout/registration flow.
    // eslint-disable-next-line no-console
    console.error("[email] send failed:", err);
  }
}

export const STORE_NOTIFICATIONS_EMAIL =
  process.env.STORE_NOTIFICATIONS_EMAIL || "orders@urbanelane.com";
