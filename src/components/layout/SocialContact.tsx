/** Store phone, Instagram and TikTok, shown in the top strip and the footer. Change them here only. */
export const STORE_PHONE = "0332-5253799";
export const STORE_PHONE_TEL = "+923325253799"; // international form for tap-to-call
export const INSTAGRAM_URL = "https://www.instagram.com/urbanlane.london?stkn=MW54c2RxYnp0d280";

export function PhoneLink({ className }: { className?: string }) {
  return (
    <a href={`tel:${STORE_PHONE_TEL}`} className={`inline-flex items-center gap-1.5 hover:underline ${className ?? ""}`} aria-label={`Call us on ${STORE_PHONE}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
      </svg>
      {STORE_PHONE}
    </a>
  );
}

export function InstagramLink({ className, size = 16, label = false }: { className?: string; size?: number; label?: boolean }) {
  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Urban Lane on Instagram"
      className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-75 ${className ?? ""}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
      {label && <span>@urbanlane.london</span>}
    </a>
  );
}

export const TIKTOK_URL = "https://www.tiktok.com/@urbanlane.london?_r=1&_t=ZS-9AKCkAsK6SX";

export function TikTokLink({ className, size = 16, label = false }: { className?: string; size?: number; label?: boolean }) {
  return (
    <a
      href={TIKTOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Urban Lane on TikTok"
      className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-75 ${className ?? ""}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.9 7.9 0 0 0 4.6 1.5V6.8a4.6 4.6 0 0 1-4.6-4.6z" />
      </svg>
      {label && <span>@urbanlane.london</span>}
    </a>
  );
}

/** Instagram + TikTok side by side. */
export function SocialLinks({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <InstagramLink size={size} />
      <TikTokLink size={size} />
    </span>
  );
}
