/** Store phone, WhatsApp, Instagram and TikTok, shown in the top strip and the footer. Change them here only. */
export const STORE_PHONE = "0332-5253799";
export const STORE_PHONE_TEL = "+923325253799"; // international form for tap-to-call
/** Opens a WhatsApp chat with the store number, with a greeting already typed. */
export const WHATSAPP_URL = `https://wa.me/${STORE_PHONE_TEL.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Urban Lane, ")}`;
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

export function WhatsAppLink({ className, size = 16, label = false }: { className?: string; size?: number; label?: boolean }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with Urban Lane on WhatsApp (${STORE_PHONE})`}
      className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-75 ${className ?? ""}`}
    >
      {/* WhatsApp glyph (Simple Icons, CC0) */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
      </svg>
      {label && <span>Chat on WhatsApp</span>}
    </a>
  );
}

/** WhatsApp + Instagram + TikTok side by side. */
export function SocialLinks({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <WhatsAppLink size={size} />
      <InstagramLink size={size} />
      <TikTokLink size={size} />
    </span>
  );
}
