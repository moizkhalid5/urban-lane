/**
 * Email addresses the admin's own orders use when there is no real one (safe in client components too).
 *
 * - A customer added by the admin without an email (a walk-in or WhatsApp buyer) gets
 *   `<something>@no-email.urbanlane.invalid`, because every customer and order needs an email.
 * - Made-up sales (Admin → Orders → Made-up sales) use `@made-up.urbanlane.invalid`. That is also how
 *   they are told apart from real orders, so they can be labelled and removed in one click.
 *
 * `.invalid` can never be delivered to (RFC 2606), and lib/email skips such addresses, so nobody is ever emailed.
 */
export const NO_EMAIL_DOMAIN = "no-email.urbanlane.invalid";
export const MADE_UP_DOMAIN = "made-up.urbanlane.invalid";

/** True for an address that isn't real (no email given, or a made-up sale). */
export const isPlaceholderEmail = (email: string | null | undefined) => !!email && /\.invalid$/i.test(email.trim());

/** True for a made-up sale's order. */
export const isMadeUpEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${MADE_UP_DOMAIN}`);

/** The email as shown in the admin: "No email" for placeholders. */
export const shownEmail = (email: string | null | undefined) => (!email || isPlaceholderEmail(email) ? "No email" : email);
