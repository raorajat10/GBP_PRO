"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendCode, signInWithGoogle, verifyCode, type LoginState } from "./actions";

// Shown only once Google sign-in is set up in Supabase (see README).
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on";

const initial: LoginState = { step: "email" };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const linkError = searchParams.get("error") === "link";
  const googleError = searchParams.get("error") === "google";

  const [emailState, emailAction, sending] = useActionState(sendCode, initial);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, initial);

  const onCodeStep = emailState.step === "code";
  const email = emailState.email ?? "";

  if (!onCodeStep) {
    return (
      <div className="flex flex-col gap-4">
        {googleEnabled && (
          <>
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="border-line hover:bg-paper w-full rounded-lg border px-4 py-2.5 font-semibold"
              >
                Continue with Google
              </button>
            </form>
            {googleError && (
              <p role="alert" className="text-danger text-sm">
                That Google account doesn&apos;t have access. Use the email your admin added, or ask
                them to add you.
              </p>
            )}
            <p className="text-ink-muted text-center text-xs">or use a one-time email code</p>
          </>
        )}
        <form action={emailAction} className="flex flex-col gap-4">
          {linkError && (
            <p role="alert" className="text-danger text-sm">
              That sign-in link didn&apos;t work or has expired. Request a new code.
            </p>
          )}
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Work email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={email}
              className="border-line bg-surface focus:outline-primary rounded-lg border px-3 py-2.5"
            />
          </label>
          {emailState.error && (
            <p role="alert" className="text-danger text-sm">
              {emailState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="bg-primary text-primary-ink rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send sign-in code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={codeAction} className="flex flex-col gap-4">
      <p className="text-ink-muted text-sm">{emailState.info}</p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Code sent to {email}</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          pattern="[0-9 ]{6,12}"
          className="border-line bg-surface focus:outline-primary rounded-lg border px-3 py-2.5 text-lg tracking-[0.3em]"
        />
      </label>
      {codeState.error && (
        <p role="alert" className="text-danger text-sm">
          {codeState.error}
        </p>
      )}
      <button
        type="submit"
        disabled={verifying}
        className="bg-primary text-primary-ink rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {verifying ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
