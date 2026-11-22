/** The owner portal's menu. Pure data, shared by the sidebar and tests. */

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export const OWNER_HOME: NavLink = { href: "/home", label: "Home" };

export const OWNER_NAV: NavGroup[] = [
  {
    label: "Listing",
    links: [
      { href: "/home/listing", label: "Business info" },
      { href: "/home/listing/attributes", label: "Attributes" },
      { href: "/home/listing/services", label: "Services" },
      { href: "/home/listing/photos", label: "Photos" },
    ],
  },
  {
    label: "Reviews",
    links: [
      { href: "/home/reviews", label: "Google reviews" },
      { href: "/home/reviews/feedback", label: "Private feedback" },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/home/insights/score", label: "Profile score" },
      { href: "/home/insights/analytics", label: "Analytics" },
      { href: "/home/insights/grid", label: "Grid ranking" },
      { href: "/home/insights/competitors", label: "Competitors" },
      { href: "/home/insights/reports", label: "Monthly reports" },
    ],
  },
  {
    label: "Grow",
    links: [
      { href: "/home/grow/posts", label: "Posts" },
      { href: "/home/grow/post-bank", label: "Post bank" },
      { href: "/home/grow/qr", label: "QR code & poster" },
      { href: "/home/grow/card", label: "Digital card" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/home/notifications", label: "Notifications" },
      { href: "/home/support", label: "Help & support" },
      { href: "/home/settings", label: "Settings" },
    ],
  },
];

/** The link that should look active for a path: the longest matching href wins. */
export function activeHref(pathname: string): string {
  const all = [OWNER_HOME, ...OWNER_NAV.flatMap((g) => g.links)];
  const matches = all.filter(
    (l) => pathname === l.href || (l.href !== "/home" && pathname.startsWith(`${l.href}/`)),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/home";
}
