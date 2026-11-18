const whenFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "20 Nov, 10:30 am" in India time. */
export const formatIst = (d: Date) => whenFmt.format(d);

/** Shorten at a word boundary so the WhatsApp template stays within its limits. */
export function previewOf(body: string, max = 600): string {
  const t = body.trim().replace(/\s*\n\s*/g, " ");
  const chars = [...t];
  if (chars.length <= max) return t;
  const cut = chars.slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
