import type { ReactNode } from "react";
import { Suspense } from "react";
import { OwnerSidebar } from "@/components/owner/sidebar";
import { OwnerTopbar } from "@/components/owner/topbar";

/**
 * Shell for the business owner's pages (/home/…): a section sidebar, a top bar with the
 * business switcher, notifications and theme, and the page. Access is checked per page.
 */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* The menu reads the URL to highlight the current page, so it streams in. */}
      <Suspense fallback={<div className="bg-rail hidden w-64 shrink-0 lg:block print:hidden" />}>
        <OwnerSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="border-line bg-surface h-16 border-b" />}>
          <OwnerTopbar />
        </Suspense>
        <main
          id="main"
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
