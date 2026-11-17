import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { listManagerOptions } from "@/lib/clients/queries";
import { ListSkeleton } from "@/components/skeleton";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/dashboard" className="text-ink-muted hover:text-primary w-fit text-sm">
          ← Clients
        </Link>
        <h1 className="text-2xl font-bold">Add client</h1>
      </div>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <NewClientForm />
      </Suspense>
    </>
  );
}

async function NewClientForm() {
  await requireUser(["admin"]);
  const managers = await listManagerOptions();
  return (
    <ClientForm
      action={createClientAction}
      managers={managers}
      canAssign
      submitLabel="Add client"
    />
  );
}
