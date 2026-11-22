"use client";

import { useActionState } from "react";
import type { OwnerFormState } from "@/lib/owner/forms";
import { recalculateScore } from "./actions";

export function RecalculateButton() {
  const [state, action, pending] = useActionState<OwnerFormState>(recalculateScore, {});
  return (
    <form action={action} className="flex items-center gap-3">
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-line hover:bg-paper rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Recalculating…" : "Recalculate"}
      </button>
    </form>
  );
}
