"use client";

import { useActionState } from "react";
import { Field, inputClass } from "@/components/form-field";
import type { FormState } from "./actions";

export function OwnerInviteForm({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Owner name" name="owner-fullName" errors={e.fullName}>
          <input id="owner-fullName" name="fullName" maxLength={100} className={inputClass} />
        </Field>
        <Field label="Owner email" name="owner-email" errors={e.email}>
          <input id="owner-email" name="email" type="email" className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="border-primary text-primary hover:bg-primary-soft w-fit rounded-lg border px-4 py-2 font-semibold disabled:opacity-60"
        >
          {pending ? "Adding…" : "Give owner a login"}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
