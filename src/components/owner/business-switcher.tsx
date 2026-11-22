"use client";

import { useTransition } from "react";
import { selectBusiness } from "@/app/(owner)/home/shell-actions";

/** Pick which of the owner's businesses the portal shows. One business: just its name. */
export function BusinessSwitcher({
  current,
  businesses,
}: {
  current: string;
  businesses: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const name = businesses.find((b) => b.id === current)?.name ?? "";
  if (businesses.length < 2) {
    return <p className="max-w-[42vw] truncate font-semibold sm:max-w-md">{name}</p>;
  }
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Business</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("clientId", e.target.value);
          start(() => selectBusiness(fd));
        }}
        className="border-line bg-surface max-w-[42vw] truncate rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-60 sm:max-w-xs"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
