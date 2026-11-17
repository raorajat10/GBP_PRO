import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

/** Shell for every signed-in page (team and client). Access is checked per page. */
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        {children}
      </main>
    </>
  );
}
