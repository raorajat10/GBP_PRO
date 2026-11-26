export type ReviewTopic = "Installation" | "Quality" | "Service" | "Support" | "Overall";

export type ReviewLanguage = "en" | "hi-en" | "hi";

export type SampleComment = {
  id: number;
  business: string;
  topic: ReviewTopic;
  language: ReviewLanguage;
  style: string;
  text: string;
};

export type SampleCommentFile = {
  business: string;
  description?: string;
  total?: number;
  min_words_per_template?: number;
  max_words_per_template?: number;
  templates: SampleComment[];
};

/**
 * Which JSON file in public/data each /review/<company> route uses.
 * Add a line here when a company's file name doesn't match its slug.
 * Any company not listed uses <slug>_review_templates.json.
 */
const REVIEW_TEMPLATE_FILES: Record<string, string> = {
  "rajasthan-battery-house": "rajasthan-battery-house_review_templates.json",
  "sarvatra-energy-private-limited": "sarvtra_review_templates.json",
};

/**
 * Loads a company-specific review inspiration JSON file.
 * Files are stored in public/data and named by company slug.
 */
export async function getSampleComments(companySlug: string): Promise<SampleCommentFile | null> {
  try {
    const safeSlug = companySlug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    const file = REVIEW_TEMPLATE_FILES[safeSlug] ?? `${safeSlug}_review_templates.json`;

    const response = await fetch(`/data/${file}`);

    if (!response.ok) return null;

    return (await response.json()) as SampleCommentFile;
  } catch {
    return null;
  }
}
