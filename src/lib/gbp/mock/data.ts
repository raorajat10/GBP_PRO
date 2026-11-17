/**
 * Sample businesses for the mock provider. All names are fictional; phone numbers use an
 * unassigned range and websites use example.com, so nothing points at a real business.
 */
import type { DayOfWeek, GbpCategory } from "../types";

export interface Archetype {
  id: string; // numeric part of locations/{id}
  title: string;
  category: GbpCategory;
  extraCategories: GbpCategory[];
  area: string;
  postalCode: string;
  description: string | null;
  hours: "full" | "weekdays" | "none";
  specialHours: boolean;
  phone: boolean;
  website: boolean;
  services: string[];
  attributes: string[];
  photos: number;
  latestPhotoDaysAgo: number;
  hasLogo: boolean;
  hasCover: boolean;
  posts: number;
  latestPostDaysAgo: number;
  reviews: number;
  avgRating: number;
  replyRate: number;
  replyHours: number;
  dailyImpressions: number;
  verified: boolean;
}

const cat = (id: string, displayName: string): GbpCategory => ({ id: `gcid:${id}`, displayName });

export const TEAM_ACCOUNT = {
  name: "accounts/sample-team",
  label: "GBP Pro team account (sample)",
};
export const OWNER_ACCOUNT_PREFIX = "accounts/sample-owner-";

export const ARCHETYPES: Archetype[] = [
  {
    id: "9100000001",
    title: "Sharma Battery House",
    category: cat("battery_store", "Battery store"),
    extraCategories: [],
    area: "Vaishali Nagar",
    postalCode: "302021",
    description: null,
    hours: "full",
    specialHours: false,
    phone: true,
    website: false,
    services: [],
    attributes: [],
    photos: 3,
    latestPhotoDaysAgo: 200,
    hasLogo: false,
    hasCover: true,
    posts: 2,
    latestPostDaysAgo: 75,
    reviews: 14,
    avgRating: 3.9,
    replyRate: 0.2,
    replyHours: 120,
    dailyImpressions: 40,
    verified: true,
  },
  {
    id: "9100000002",
    title: "Surya Rooftop Solar",
    category: cat("solar_energy_company", "Solar energy company"),
    extraCategories: [
      cat("solar_energy_system_service", "Solar energy system service"),
      cat("electrical_installation_service", "Electrical installation service"),
    ],
    area: "Malviya Nagar",
    postalCode: "302017",
    description:
      "Surya Rooftop Solar designs and installs on-grid rooftop solar systems for homes, schools and small businesses across Jaipur. Our trained team handles the site survey, installation, net-metering paperwork and after-sales service. We help customers understand system size, expected generation and maintenance so they can make an informed decision. Call us to book a site survey.",
    hours: "full",
    specialHours: true,
    phone: true,
    website: true,
    services: [
      "Rooftop solar installation",
      "Site survey",
      "Net-metering application support",
      "Solar panel cleaning",
      "Annual maintenance",
    ],
    attributes: ["online_appointments", "onsite_services", "accepts_upi", "wheelchair_accessible"],
    photos: 28,
    latestPhotoDaysAgo: 5,
    hasLogo: true,
    hasCover: true,
    posts: 18,
    latestPostDaysAgo: 3,
    reviews: 86,
    avgRating: 4.7,
    replyRate: 0.96,
    replyHours: 10,
    dailyImpressions: 180,
    verified: true,
  },
  {
    id: "9100000003",
    title: "Dr. Mehta Dental Care",
    category: cat("dentist", "Dentist"),
    extraCategories: [],
    area: "C-Scheme",
    postalCode: "302001",
    description:
      "Dental clinic in C-Scheme offering check-ups, cleaning, fillings and root canal treatment.",
    hours: "weekdays",
    specialHours: false,
    phone: true,
    website: true,
    services: ["Dental check-up", "Teeth cleaning", "Root canal treatment"],
    attributes: ["online_appointments"],
    photos: 9,
    latestPhotoDaysAgo: 40,
    hasLogo: true,
    hasCover: false,
    posts: 4,
    latestPostDaysAgo: 20,
    reviews: 37,
    avgRating: 4.4,
    replyRate: 0.55,
    replyHours: 40,
    dailyImpressions: 90,
    verified: true,
  },
  {
    id: "9100000004",
    title: "Gupta Kirana & General Store",
    category: cat("grocery_store", "Grocery store"),
    extraCategories: [],
    area: "Mansarovar",
    postalCode: "302020",
    description: null,
    hours: "none",
    specialHours: false,
    phone: true,
    website: false,
    services: [],
    attributes: [],
    photos: 1,
    latestPhotoDaysAgo: 10,
    hasLogo: false,
    hasCover: false,
    posts: 0,
    latestPostDaysAgo: 0,
    reviews: 3,
    avgRating: 4.3,
    replyRate: 0,
    replyHours: 0,
    dailyImpressions: 8,
    verified: true,
  },
  {
    id: "9100000005",
    title: "Jaipur Inverter Point",
    category: cat("battery_store", "Battery store"),
    extraCategories: [cat("electrical_supply_store", "Electrical supply store")],
    area: "Raja Park",
    postalCode: "302004",
    description:
      "Jaipur Inverter Point sells inverters, inverter batteries and car and bike batteries in Raja Park. We offer home installation, old battery exchange and warranty support for leading brands.",
    hours: "full",
    specialHours: false,
    phone: true,
    website: true,
    services: ["Inverter installation", "Battery exchange", "Battery health check"],
    attributes: ["accepts_upi"],
    photos: 12,
    latestPhotoDaysAgo: 15,
    hasLogo: true,
    hasCover: true,
    posts: 6,
    latestPostDaysAgo: 12,
    reviews: 52,
    avgRating: 4.2,
    replyRate: 0.7,
    replyHours: 30,
    dailyImpressions: 110,
    verified: true,
  },
  {
    id: "9100000006",
    title: "Green Sun Solar Solutions",
    category: cat("solar_energy_company", "Solar energy company"),
    extraCategories: [],
    area: "Jagatpura",
    postalCode: "302017",
    description: "Solar panel installation for homes and businesses in Jagatpura and nearby areas.",
    hours: "weekdays",
    specialHours: false,
    phone: true,
    website: true,
    services: ["Solar installation", "Solar maintenance"],
    attributes: [],
    photos: 6,
    latestPhotoDaysAgo: 90,
    hasLogo: false,
    hasCover: true,
    posts: 1,
    latestPostDaysAgo: 120,
    reviews: 21,
    avgRating: 4.5,
    replyRate: 0.1,
    replyHours: 72,
    dailyImpressions: 55,
    verified: true,
  },
];

export const WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const REVIEWERS = [
  "Rahul Sharma",
  "Priya Meena",
  "Amit Agarwal",
  "Sunita Choudhary",
  "Vikram Singh Rathore",
  "Neha Jain",
  "Manoj Kumawat",
  "Pooja Saini",
  "Arjun Shekhawat",
  "Kavita Gupta",
  "Rohit Yadav",
  "Anjali Khandelwal",
  "Deepak Verma",
  "Ritu Sharma",
  "Sanjay Bansal",
  "Mohit Goyal",
];

/** Review text by star bucket, mixing English, Hindi and Hinglish like real Jaipur reviews. */
export const REVIEW_TEXT: Record<"good" | "ok" | "bad", string[]> = {
  good: [
    "Very good service, work was done on time.",
    "Professional team and honest advice. Recommended.",
    "Staff explained everything clearly. Happy with the experience.",
    "बहुत अच्छी सर्विस, समय पर काम हुआ।",
    "सही सलाह दी और व्यवहार भी अच्छा है। धन्यवाद।",
    "Bahut badiya service, sab kuch time pe hua.",
    "Rate bhi sahi aur kaam bhi accha. Full satisfied.",
    "Staff ka behaviour bahut accha hai, dobara zaroor aayenge.",
  ],
  ok: [
    "Service was okay, had to wait a bit.",
    "Decent experience, could be faster.",
    "काम ठीक था पर थोड़ी देर हुई।",
    "Theek hai, par response thoda slow tha.",
  ],
  bad: [
    "Called many times, nobody picked up.",
    "Work got delayed by three days and no update was given.",
    "सर्विस बहुत धीमी है, कोई जवाब नहीं मिला।",
    "Bahut wait karaya, experience accha nahi raha.",
  ],
};

export const REPLY_TEXT = {
  good: "Thank you so much for your kind words! We're glad we could help.",
  ok: "Thank you for your feedback. We're working on being quicker for you next time.",
  bad: "We're sorry about your experience. Please call us so we can make this right.",
};

export const POST_TEXT = [
  "We're open all week — visit us or call for a quick quote.",
  "New stock has arrived. Drop by to see the latest range.",
  "Our team completed another installation this week. Thank you for trusting us!",
  "Tips for the season: book your service early to avoid the rush.",
];
