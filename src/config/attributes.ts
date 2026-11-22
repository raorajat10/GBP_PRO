/**
 * Google profile attributes we show owners, grouped the way customers think about them.
 * Keys match what our Google layer returns in profile.attributes (e.g. "accepts_upi").
 */
export const ATTRIBUTE_GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: "Payments",
    items: [
      { key: "accepts_upi", label: "UPI (GPay, PhonePe, Paytm)" },
      { key: "accepts_cards", label: "Debit and credit cards" },
      { key: "accepts_nfc", label: "Tap to pay" },
      { key: "accepts_cash", label: "Cash" },
    ],
  },
  {
    label: "Service options",
    items: [
      { key: "onsite_services", label: "Visits your home or site" },
      { key: "online_appointments", label: "Online appointments" },
      { key: "online_estimates", label: "Free quotes online" },
      { key: "home_delivery", label: "Delivery" },
    ],
  },
  {
    label: "Accessibility",
    items: [
      { key: "wheelchair_accessible", label: "Wheelchair-accessible entrance" },
      { key: "wheelchair_parking", label: "Wheelchair-accessible parking" },
      { key: "wheelchair_restroom", label: "Wheelchair-accessible restroom" },
      { key: "wheelchair_seating", label: "Wheelchair-accessible seating" },
    ],
  },
  {
    label: "Amenities",
    items: [
      { key: "free_parking", label: "Free parking" },
      { key: "restroom", label: "Restroom" },
      { key: "free_wifi", label: "Free Wi-Fi" },
    ],
  },
  {
    label: "About the business",
    items: [{ key: "women_owned", label: "Women-owned" }],
  },
];

export const ATTRIBUTE_LABELS: Record<string, string> = Object.fromEntries(
  ATTRIBUTE_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

/** Readable name for any key, including ones not in the list above. */
export function attributeLabel(key: string): string {
  return ATTRIBUTE_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
