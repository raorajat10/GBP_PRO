"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { signOut } from "@/lib/auth/actions";
import { activeHref, OWNER_HOME, OWNER_NAV } from "@/lib/owner/nav";

/** Owner portal menu: fixed rail on desktop, slide-in drawer on phones. */
export function OwnerSidebar() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating, and on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (href: string, label: string) => {
    const current = href === active;
    return (
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`relative block rounded-lg px-3 py-1.5 text-[0.95rem] transition-colors ${
          current
            ? "bg-rail-active text-rail-ink font-semibold"
            : "text-rail-muted hover:text-rail-ink hover:bg-rail-active/60"
        }`}
      >
        {current && (
          <span
            className="bg-accent absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r"
            aria-hidden="true"
          />
        )}
        {label}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line bg-surface fixed top-3 left-3 z-30 flex size-10 items-center justify-center rounded-lg border lg:hidden print:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="owner-menu"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="owner-menu"
        className={`bg-rail text-rail-ink fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link href="/home" className="text-lg font-bold tracking-tight">
            {brand.name}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-rail-muted hover:text-rail-ink rounded p-1 lg:hidden"
            aria-label="Close menu"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label="Owner menu" className="flex-1 overflow-y-auto px-5 pb-6">
          {link(OWNER_HOME.href, OWNER_HOME.label)}
          {OWNER_NAV.map((group) => (
            <div key={group.label} className="mt-5">
              <p className="text-rail-muted/80 px-3 pb-1 text-xs font-medium">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.links.map((l) => (
                  <li key={l.href}>{link(l.href, l.label)}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <form action={signOut} className="border-rail-active border-t px-5 py-4 lg:hidden">
          <button type="submit" className="text-rail-muted hover:text-rail-ink text-sm font-medium">
            Sign out
          </button>
        </form>
      </aside>
    </>
  );
}
