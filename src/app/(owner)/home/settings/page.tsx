import type { Metadata } from "next";
import { Suspense } from "react";
import { getOwnerContext } from "@/lib/owner/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListSkeleton } from "@/components/skeleton";
import { PageHeader, Panel, Pill } from "@/components/owner/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your details and how we keep you posted." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const { user, businesses } = await getOwnerContext();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, notify_whatsapp, notify_email")
    .eq("id", user.id)
    .single();

  return (
    <>
      <Panel title="Your profile">
        <SettingsForm
          fullName={profile?.full_name ?? ""}
          email={profile?.email ?? user.email}
          notifyWhatsapp={profile?.notify_whatsapp ?? true}
          notifyEmail={profile?.notify_email ?? true}
        />
      </Panel>
      <Panel
        title="Your businesses"
        description="Businesses this login can see. Our team adds or removes them."
      >
        {businesses.length ? (
          <ul className="divide-line flex flex-col divide-y">
            {businesses.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="font-medium">{b.name}</span>
                <Pill tone={b.status === "active" ? "success" : "muted"}>
                  {b.status === "active" ? "Active" : "Paused"}
                </Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted text-sm">None yet.</p>
        )}
      </Panel>
    </>
  );
}
