"use client";

import { useActionState } from "react";
import { inviteTeamMember, type InviteState } from "./actions";

const field = "border-line bg-surface focus:outline-primary rounded-lg border px-3 py-2";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteTeamMember, {});

  return (
    <form
      action={action}
      className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5"
    >
      <h2 className="text-lg font-semibold">Add a team member</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Full name</span>
          <input name="fullName" required maxLength={100} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Role</span>
          <select name="role" defaultValue="manager" className={field}>
            <option value="manager">Account manager</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {state.message && (
        <p role="status" className={state.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-ink w-fit rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add team member"}
      </button>
    </form>
  );
}
