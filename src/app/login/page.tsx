import type { Metadata } from "next";
import { Suspense } from "react";
import { brand } from "@/config/brand";
import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="border-line bg-surface flex w-full max-w-sm flex-col gap-6 rounded-2xl border p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Sign in to {brand.name}</h1>
            <p className="text-ink-muted text-sm">We&apos;ll email you a one-time code.</p>
          </div>
          <Suspense fallback={<div className="bg-paper h-32 animate-pulse rounded-lg" />}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
