import type { ReactNode } from "react";

export const inputClass =
  "border-line bg-surface focus:outline-primary w-full rounded-lg border px-3 py-2 disabled:opacity-60";

export function Field({
  label,
  name,
  hint,
  errors,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  errors?: string[];
  children: ReactNode;
}) {
  const error = errors?.[0];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="text-ink-muted text-xs">{hint}</p>
      )}
    </div>
  );
}
