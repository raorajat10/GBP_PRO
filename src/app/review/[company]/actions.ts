"use server";

import { z } from "zod";
import { polishCustomerReview, type ReviewLanguage } from "@/lib/ai/review-polish";
import { AiError } from "@/lib/ai/writer";
import { getPublicClient } from "@/lib/clients/public";
import { notifyClient } from "@/lib/notifications/service";
import { allowPublicRequest } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const polishSchema = z.object({
  company: z.string().trim().min(1).max(60),
  notes: z
    .string()
    .trim()
    .min(5, "Write a few words about your experience first.")
    .max(2000, "Keep it under 2,000 characters."),
  rating: z.number().int().min(1).max(5),
  language: z.enum(["en", "hi", "hinglish"]),
});

/** Tidies the customer's own notes. Never writes a review for them. */
export async function polishReviewAction(input: {
  company: string;
  notes: string;
  rating: number;
  language: ReviewLanguage;
}): Promise<{ text?: string; sample?: boolean; error?: string }> {
  const parsed = polishSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your text." };

  const client = await getPublicClient(parsed.data.company);
  if (!client) return { error: "This review link isn't valid." };
  if (!(await allowPublicRequest(`polish:${client.slug}`, { max: 10, windowMs: 10 * 60_000 })))
    return { error: "Too many tries. Please wait a few minutes, or post your words as written." };

  try {
    return await polishCustomerReview({
      notes: parsed.data.notes,
      business: client.name,
      rating: parsed.data.rating,
      language: parsed.data.language,
    });
  } catch (error) {
    return {
      error:
        error instanceof AiError
          ? error.message
          : "Couldn't tidy your review. You can still post it as written.",
    };
  }
}

const feedbackSchema = z.object({
  company: z.string().trim().min(1).max(60),
  rating: z.number().int().min(1).max(5).nullable(),
  message: z
    .string()
    .trim()
    .min(3, "Tell us a little about what happened.")
    .max(2000, "Keep it under 2,000 characters."),
  contact: z
    .string()
    .trim()
    .max(100, "Keep this under 100 characters.")
    .transform((v) => (v === "" ? null : v)),
});

/** Private message to the business (seen by our team on the client page). */
export async function sendPrivateFeedbackAction(input: {
  company: string;
  rating: number | null;
  message: string;
  contact: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const client = await getPublicClient(parsed.data.company);
  if (!client) return { error: "This review link isn't valid." };
  if (!(await allowPublicRequest(`feedback:${client.slug}`, { max: 5, windowMs: 10 * 60_000 })))
    return { error: "Too many messages. Please wait a few minutes." };

  const { error } = await createSupabaseAdminClient().from("review_feedback").insert({
    client_id: client.id,
    rating: parsed.data.rating,
    message: parsed.data.message,
    contact: parsed.data.contact,
  });
  if (error) return { error: "Couldn't send your message. Please try again." };
  await notifyClient({
    clientId: client.id,
    kind: "feedback",
    title: "New private feedback from a customer",
    body: parsed.data.message.slice(0, 160),
    link: "/home/reviews/feedback",
  });
  return { ok: true };
}
