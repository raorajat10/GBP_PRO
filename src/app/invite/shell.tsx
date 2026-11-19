import type { ReactNode } from "react";
import { brand } from "@/config/brand";

/** Simple phone-first frame for the public owner pages (no app header, no login). */
export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
      <p className="text-primary text-sm font-semibold">{brand.name}</p>
      {children}
    </main>
  );
}

export function Notice({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "success" | "error";
  children: ReactNode;
}) {
  const style =
    tone === "success"
      ? "border-success bg-primary-soft"
      : tone === "error"
        ? "border-danger bg-surface"
        : "border-line bg-surface";
  return (
    <section role="status" className={`rounded-2xl border p-4 ${style}`}>
      <h1 className="font-semibold">{title}</h1>
      <p className="text-ink-muted mt-1 text-sm">{children}</p>
    </section>
  );
}
