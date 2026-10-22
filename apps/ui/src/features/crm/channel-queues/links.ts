/** Deep-link helpers for the WhatsApp / LinkedIn / Email queues. Behavior
 * is copied verbatim from legacy `domain/ChannelActivityQueue.tsx`; each
 * returns null when the source value is unusable, which disables the button. */

/** Normalizes a stored contact number into a `wa.me` deep link. */
export function waLink(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Normalizes a stored LinkedIn URL/handle into an absolute link. */
export function linkedInLink(url: string | null | undefined): string | null {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

/** Builds a `mailto:` deep link from a stored email address. */
export function mailLink(email: string | null | undefined): string | null {
  const trimmed = (email || "").trim();
  return trimmed ? `mailto:${trimmed}` : null;
}
