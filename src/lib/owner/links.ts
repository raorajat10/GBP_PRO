/** Public links for a business. Pure, so pages and tests share them. */

export function mapsLink(p: { placeId: string | null; title: string }): string {
  return p.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.placeId)}`
    : `https://www.google.com/maps/search/${encodeURIComponent(p.title)}`;
}

export function directionsLink(p: { placeId: string | null; title: string }): string {
  const dest = `destination=${encodeURIComponent(p.title)}`;
  return p.placeId
    ? `https://www.google.com/maps/dir/?api=1&${dest}&destination_place_id=${encodeURIComponent(p.placeId)}`
    : `https://www.google.com/maps/dir/?api=1&${dest}`;
}

const base = (appUrl: string) => appUrl.replace(/\/$/, "");

export const reviewPageUrl = (appUrl: string, slug: string) =>
  `${base(appUrl)}/review/${encodeURIComponent(slug)}`;

export const cardPageUrl = (appUrl: string, slug: string) =>
  `${base(appUrl)}/card/${encodeURIComponent(slug)}`;

/** Indian mobile numbers stored as +91… → digits for wa.me links. */
export const whatsappDigits = (phone: string) => phone.replace(/[^\d]/g, "");

/** An Indian mobile number (+91 6–9…) can take WhatsApp; landlines can't. */
export function mobileForWhatsApp(phone: string | null): string | null {
  if (!phone) return null;
  const d = whatsappDigits(phone);
  const local = d.startsWith("91") && d.length === 12 ? d.slice(2) : d.length === 10 ? d : null;
  return local && /^[6-9]\d{9}$/.test(local) ? `91${local}` : null;
}
