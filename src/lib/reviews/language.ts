import type { Language } from "@/lib/clients/schema";

/**
 * Reply in the review's own language (PLAN M9): Devanagari → Hindi; Hindi written in
 * Roman letters → Hinglish; otherwise English. A rating with no text falls back to the
 * business's preferred language.
 */
const HINGLISH_WORDS = [
  "bahut",
  "accha",
  "acha",
  "achha",
  "badhiya",
  "bhai",
  "hai",
  "nahi",
  "nhi",
  "kaam",
  "dhanyawad",
  "shukriya",
  "sahi",
  "bekar",
  "mast",
  "ekdum",
  "jaldi",
  "paisa",
];

export function replyLanguage(comment: string | null, fallback: Language): Language {
  const text = comment?.trim() ?? "";
  if (!text) return fallback;
  const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const letters = (text.match(/[A-Za-zऀ-ॿ]/g) ?? []).length;
  if (letters && devanagari / letters > 0.3) return "hi";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((w) => HINGLISH_WORDS.includes(w)).length;
  if (hits >= 2 || (words.length <= 6 && hits >= 1)) return "hinglish";
  return "en";
}

/** Google allows up to 4,096 characters; keep a margin. */
export const MAX_REPLY_LENGTH = 4000;
