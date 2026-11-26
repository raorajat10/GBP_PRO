
export type ReviewTopic =
  | "Installation"
  | "Quality"
  | "Service"
  | "Support"
  | "Overall";

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
  templates: SampleComment[];
};

/**
 * Loads a company-specific review inspiration JSON file.
 * Files are stored in public/data and named by company slug.
 */
export async function getSampleComments(
  companySlug: string
): Promise<SampleCommentFile | null> {
  try {
    const safeSlug = companySlug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    const response = await fetch(
      `/data/${safeSlug}_review_templates.json`
    );

    if (!response.ok) return null;

    return (await response.json()) as SampleCommentFile;
  } catch {
    return null;
  }
}
