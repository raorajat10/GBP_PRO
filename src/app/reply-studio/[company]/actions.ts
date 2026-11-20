"use server";

import { z } from "zod";
import { generateReviewReplies } from "@/lib/ai/review-reply";
import { AiError } from "@/lib/ai/writer";
import { getPublicReplyStudioClient } from "@/lib/clients/public";
import { allowPublicRequest } from "@/lib/rate-limit";

const schema = z.object({
  company: z.string().trim().min(1).max(60),
  review: z
    .string()
    .trim()
    .min(10, "Paste the review (at least 10 characters).")
    .max(5000, "Reviews must be under 5,000 characters."),
  language: z.enum(["en", "hi", "hinglish"]),
});

export async function createPublicReplyDrafts(_previous: unknown, formData: FormData) {
  const parsed = schema.safeParse({
    company: formData.get("company"),
    review: formData.get("review"),
    language: formData.get("language"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  // The business name always comes from the clients table, never from the form.
  const company = await getPublicReplyStudioClient(parsed.data.company);
  if (!company) return { error: "This reply studio link isn't valid." };

  if (!(await allowPublicRequest(`reply:${company.slug}`, { max: 15, windowMs: 10 * 60_000 })))
    return { error: "Too many requests. Please wait a few minutes and try again." };

  try {
    return await generateReviewReplies({
      review: parsed.data.review,
      business: company.name,
      language: parsed.data.language,
    });
  } catch (error) {
    return {
      error:
        error instanceof AiError ? error.message : "Couldn't create replies. Please try again.",
    };
  }
}
