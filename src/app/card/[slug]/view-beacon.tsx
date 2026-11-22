"use client";

import { useEffect } from "react";

/** Counts one view per visit for the owner's card insights. */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `card-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: still count the view.
    }
    fetch(`/card/${encodeURIComponent(slug)}/go`, { method: "POST", keepalive: true }).catch(
      () => {},
    );
  }, [slug]);
  return null;
}
