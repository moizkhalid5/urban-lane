/**
 * HTML email templates. Minimal, inline-styled, client-friendly markup.
 * Each builder returns { subject, html, text } ready for sendEmail().
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const STORE = "Urban Lane";

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7e7e7">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #e7e7e7">
          <span style="font-size:20px;font-weight:600;letter-spacing:1px;text-transform:uppercase">${STORE}</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e7e7e7;font-size:12px;color:#6b6b6b">
          ${STORE} · <a href="${APP_URL}" style="color:#111">${APP_URL.replace(/^https?:\/\//, "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;text-transform:uppercase;letter-spacing:.5px">${label}</a>`;

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function verifyEmailTemplate(name: string, url: string) {
  const html = layout(
    "Confirm your email",
    `<p>Hi ${name || "there"},</p>
     <p>Welcome to ${STORE}. Please confirm your email address to activate your account.</p>
     <p style="margin:24px 0">${btn(url, "Verify email")}</p>
     <p style="font-size:12px;color:#6b6b6b">Or paste this link into your browser:<br>${url}</p>
     <p style="font-size:12px;color:#6b6b6b">This link expires in 24 hours.</p>`,
  );
  return { subject: `Confirm your email — ${STORE}`, html, text: strip(html) };
}

export function welcomeTemplate(name: string) {
  const html = layout(
    "Welcome to Urban Lane",
    `<p>Hi ${name || "there"},</p>
     <p>Your account is now active. Explore the latest in fashion, beauty and lifestyle.</p>
     <p style="margin:24px 0">${btn(APP_URL, "Start shopping")}</p>`,
  );
  return { subject: `Welcome to ${STORE}`, html, text: strip(html) };
}

export function passwordResetTemplate(name: string, url: string) {
  const html = layout(
    "Reset your password",
    `<p>Hi ${name || "there"},</p>
     <p>We received a request to reset your password. This link expires in 1 hour.</p>
     <p style="margin:24px 0">${btn(url, "Reset password")}</p>
     <p style="font-size:12px;color:#6b6b6b">If you didn't request this, you can ignore this email.</p>
     <p style="font-size:12px;color:#6b6b6b">${url}</p>`,
  );
  return { subject: `Reset your password — ${STORE}`, html, text: strip(html) };
}

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  totalFormatted: string;
  lines: { title: string; qty: number; priceFormatted: string }[];
};

export function orderConfirmationTemplate(d: OrderEmailData) {
  const rows = d.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f1f1">${l.title} × ${l.qty}</td>
         <td align="right" style="padding:8px 0;border-bottom:1px solid #f1f1f1">${l.priceFormatted}</td></tr>`,
    )
    .join("");
  const html = layout(
    `Order ${d.orderNumber} confirmed`,
    `<p>Hi ${d.customerName},</p>
     <p>Thanks for your order. We'll email you again when it ships.</p>
     <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}
       <tr><td style="padding:12px 0;font-weight:600">Total</td>
       <td align="right" style="padding:12px 0;font-weight:600">${d.totalFormatted}</td></tr></table>
     <p style="margin:24px 0">${btn(`${APP_URL}/account/orders`, "View order")}</p>`,
  );
  return { subject: `Order ${d.orderNumber} confirmed — ${STORE}`, html, text: strip(html) };
}

export function orderStatusTemplate(orderNumber: string, status: string, tracking?: string) {
  const html = layout(
    `Update on order ${orderNumber}`,
    `<p>Your order status is now <strong>${status}</strong>.</p>
     ${tracking ? `<p>Tracking number: <strong>${tracking}</strong></p>` : ""}
     <p style="margin:24px 0">${btn(`${APP_URL}/account/orders`, "View order")}</p>`,
  );
  return { subject: `Order ${orderNumber}: ${status} — ${STORE}`, html, text: strip(html) };
}

export function shippingConfirmationTemplate(orderNumber: string, tracking?: string, carrier?: string) {
  const html = layout(
    `Your order ${orderNumber} has shipped`,
    `<p>Good news — your order is on its way.</p>
     ${carrier ? `<p>Carrier: <strong>${carrier}</strong></p>` : ""}
     ${tracking ? `<p>Tracking number: <strong>${tracking}</strong></p>` : ""}
     <p style="margin:24px 0">${btn(`${APP_URL}/account/orders`, "Track order")}</p>`,
  );
  return { subject: `Shipped: order ${orderNumber} — ${STORE}`, html, text: strip(html) };
}

export function contactNotificationTemplate(name: string, email: string, subject: string, message: string) {
  const html = layout(
    "New contact message",
    `<p><strong>From:</strong> ${name} (${email})</p>
     <p><strong>Subject:</strong> ${subject || "—"}</p>
     <p><strong>Message:</strong></p><p>${message.replace(/\n/g, "<br>")}</p>`,
  );
  return { subject: `Contact form: ${subject || "New message"}`, html, text: strip(html) };
}

export function refundNotificationTemplate(email: string, subject: string, reason: string, orderNumber?: string) {
  const html = layout(
    "New refund / return request",
    `<p><strong>From:</strong> ${email}</p>
     ${orderNumber ? `<p><strong>Order:</strong> ${orderNumber}</p>` : ""}
     <p><strong>Subject:</strong> ${subject}</p>
     <p><strong>Reason:</strong></p><p>${reason.replace(/\n/g, "<br>")}</p>`,
  );
  return { subject: `Refund request: ${subject}`, html, text: strip(html) };
}

export function newsletterWelcomeTemplate() {
  const html = layout(
    "Thanks for subscribing",
    `<p>Thank you for subscribing to ${STORE}.</p>
     <p>You'll be the first to hear about new arrivals, offers and exclusive drops.</p>
     <p style="margin:24px 0">${btn(APP_URL, "Shop new in")}</p>`,
  );
  return { subject: `Welcome to the ${STORE} list`, html, text: strip(html) };
}
