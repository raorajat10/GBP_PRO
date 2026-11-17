import Link from "next/link";
import { brand } from "@/config/brand";

const milestones = [
  { id: "M1", label: "Project foundation", done: true },
  { id: "M2", label: "Login and roles", done: true },
  { id: "M3", label: "Clients and agency dashboard", done: true },
  { id: "M4", label: "Connect Google profile (mock)", done: false },
  { id: "M5", label: "Profile audit score", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-3">
        <span className="bg-primary-soft text-primary inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
          <span aria-hidden className="bg-primary size-2 rounded-full" />
          In development
        </span>
        <h1 className="text-4xl font-bold tracking-tight">{brand.name}</h1>
        <p className="text-ink-muted text-xl">{brand.tagline}</p>
        <p className="text-ink-muted max-w-prose">{brand.description}</p>
        <Link
          href="/login"
          className="bg-primary text-primary-ink mt-2 w-fit rounded-lg px-4 py-2.5 font-semibold"
        >
          Team sign in
        </Link>
      </header>

      <section aria-labelledby="progress" className="border-line bg-surface rounded-2xl border p-6">
        <h2 id="progress" className="mb-4 text-lg font-semibold">
          Build progress
        </h2>
        <ol className="flex flex-col gap-3">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  m.done ? "bg-primary text-primary-ink" : "bg-accent-soft text-ink-muted"
                }`}
              >
                {m.id}
              </span>
              <span className={m.done ? "font-medium" : "text-ink-muted"}>{m.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
