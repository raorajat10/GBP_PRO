"use client";

import { useActionState, type ReactNode } from "react";

interface State {
  ok?: boolean;
  message?: string;
}

const variants = {
  primary: "bg-primary text-primary-ink font-semibold",
  secondary: "border-line hover:bg-paper border",
  danger: "border-danger text-danger border",
};

/** A form whose submit runs a server action and shows its message inline. */
export function ActionForm({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  children,
  confirm,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  label: string;
  pendingLabel: string;
  variant?: keyof typeof variants;
  children?: ReactNode;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg px-4 py-2 disabled:opacity-60 ${variants[variant]}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
