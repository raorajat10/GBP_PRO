"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { generateReviewReplies } from "@/lib/ai/review-reply";
import { AiError } from "@/lib/ai/writer";

const schema = z.object({
  review: z
    .string()
    .trim()
    .min(10, "Paste the review (at least 10 characters). ")
    .max(5000, "Reviews must be under 5,000 characters."),
  business: z.string().trim().min(1).max(100),
  language: z.enum(["en", "hi", "hinglish"]),
});

export async function createReplyDrafts(_previous: unknown, formData: FormData) {
  await requireUser(["admin", "manager"]);
  const parsed = schema.safeParse({
    review: formData.get("review"),
    business: formData.get("business"),
    language: formData.get("language"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  try {
    return await generateReviewReplies(parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof AiError ? error.message : "Couldn't create replies. Please try again.",
    };
  }
}
