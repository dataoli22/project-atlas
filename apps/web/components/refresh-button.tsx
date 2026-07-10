"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RefreshButtonProps = {
  label?: string;
};

/** Forces the page's server components to re-fetch (router.refresh()) rather than relying on the
 * next navigation to pick up new data - useful right after triggering a connector sync or a
 * planner refresh elsewhere, or just to re-check for updated data without a full page reload. */
export function RefreshButton({ label = "Refresh" }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function refresh() {
    startTransition(() => {
      router.refresh();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    });
  }

  return (
    <button
      type="button"
      className="atlas-button atlas-button--secondary"
      onClick={refresh}
      disabled={isPending}
    >
      {isPending ? "Refreshing..." : justRefreshed ? "Refreshed" : label}
    </button>
  );
}
