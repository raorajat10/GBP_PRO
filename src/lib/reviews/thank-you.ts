import type { Language } from "@/lib/clients/schema";

/**
 * Ready-made "thank you for your review" replies. No AI and no API call: the team picks
 * one, edits if they like, and posts it. Pure, unit-tested.
 */

export interface ThankYouOption {
  label: string;
  text: string;
}

/** "Asha Verma" → "Asha"; Google's anonymous placeholder → no name. */
export function firstName(reviewer: string): string | null {
  const name = reviewer.trim();
  if (!name || /^a google user$/i.test(name)) return null;
  return name.split(/\s+/)[0];
}

export function thankYouReplies(input: {
  reviewer: string;
  stars: number;
  business: string;
  language: Language;
}): ThankYouOption[] {
  const n = firstName(input.reviewer);
  const b = input.business.trim();
  const low = input.stars <= 3;

  if (input.language === "hi") {
    const hi = n ? `${n} जी, ` : "";
    return low
      ? [
          {
            label: "धन्यवाद + खेद",
            text: `${hi}अपना अनुभव बताने के लिए धन्यवाद। हमें खेद है कि सब कुछ आपकी उम्मीद के मुताबिक नहीं रहा। आपकी बात हमारी टीम तक पहुँच गई है और हम इसे बेहतर करेंगे। — ${b}`,
          },
          {
            label: "छोटा",
            text: `${hi}आपकी समीक्षा के लिए धन्यवाद। हम इसे सुधारने पर काम करेंगे। — ${b}`,
          },
        ]
      : [
          {
            label: "धन्यवाद",
            text: `${hi}आपकी शानदार समीक्षा के लिए बहुत-बहुत धन्यवाद! ${b} पर भरोसा करने के लिए आभार। 🙏`,
          },
          {
            label: "छोटा",
            text: `${hi}समीक्षा के लिए धन्यवाद! आपसे फिर मिलने की उम्मीद है। — ${b}`,
          },
        ];
  }

  if (input.language === "hinglish") {
    const hl = n ? `${n} ji, ` : "";
    return low
      ? [
          {
            label: "Thanks + sorry",
            text: `${hl}apna feedback dene ke liye dhanyawad. Humein afsos hai ki experience utna accha nahi raha. Hum isse zaroor behtar karenge. — ${b}`,
          },
          {
            label: "Short",
            text: `${hl}review ke liye shukriya. Hum is par kaam karenge. — ${b}`,
          },
        ]
      : [
          {
            label: "Thank you",
            text: `${hl}itne acche review ke liye bahut bahut dhanyawad! ${b} par bharosa karne ke liye shukriya. 🙏`,
          },
          {
            label: "Short",
            text: `${hl}review ke liye shukriya! Phir milte hain. — ${b}`,
          },
        ];
  }

  // "Thank you, Asha, for…" or, with no name, "Thank you for…".
  const en = n ? `Thank you, ${n},` : "Thank you";
  const enBang = n ? `Thank you, ${n}!` : "Thank you!";
  return low
    ? [
        {
          label: "Thanks + sorry",
          text: `${en} for taking the time to share your feedback. We're sorry your experience wasn't what you expected. We've passed this on to our team and will work to make it right. — ${b}`,
        },
        {
          label: "Short",
          text: `${en} for your review. We're sorry about this and will do better. — ${b}`,
        },
      ]
    : [
        {
          label: "Thank you",
          text: `${en} for the wonderful review! We're glad you chose ${b} and look forward to serving you again.`,
        },
        {
          label: "Short",
          text: `${en} for your kind words! — ${b}`,
        },
        {
          label: "Warm",
          text: `${enBang} Reviews like yours mean a lot to our whole team at ${b}. 🙏`,
        },
      ];
}
