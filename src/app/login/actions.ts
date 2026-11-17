"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homePathForRole, safeNextPath } from "@/lib/auth/paths";
import { serverEnv } from "@/lib/env";

export interface LoginState {
  step: "email" | "code";
  email?: string;
  error?: string;
  info?: string;
}

const emailSchema = z.email();

function readEmail(formData: FormData) {
  return emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
}

/** Step 1: email a one-time code. Invite-only: unknown emails never get an account. */
export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = readEmail(formData);
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const origin = (await headers()).get("origin") ?? serverEnv().APP_URL;
  const callback = new URL("/auth/callback", origin);
  if (next) callback.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });

  if (error?.status === 429) {
    return { step: "email", email, error: "Too many attempts. Wait a minute and try again." };
  }
  // Other errors (e.g. no account for this email) are deliberately not revealed,
  // so nobody can use this form to find out who has an account.
  return {
    step: "code",
    email,
    info: "If this email has access, we've sent a sign-in code. It expires in 1 hour.",
  };
}

/** Step 2: check the code, then go to the right home for the user's role. */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = readEmail(formData);
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    return { step: "code", email, error: "Enter the code from the email." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { step: "code", email, error: "That code is wrong or has expired." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const next = safeNextPath(String(formData.get("next") ?? ""));
  redirect(next ?? homePathForRole(profile?.role ?? null));
}
