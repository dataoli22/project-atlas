"use client";

import { useEffect } from "react";

export default function GlobalRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Atlas route error boundary caught:", error);
  }, [error]);

  return (
    <div className="atlas-error-panel" role="alert">
      <div>
        <div className="atlas-panel__eyebrow">Something went wrong</div>
        <h1 className="atlas-panel__title" style={{ fontSize: "1.4rem" }}>
          This page hit an unexpected error
        </h1>
        <p className="atlas-brand__summary">
          Atlas is local-first, so this is almost always a bug or a local backend that isn&apos;t
          reachable, not a remote outage. Retrying usually recovers a transient failure; if it keeps
          happening, check that the Atlas backend is running.
        </p>
      </div>
      <div className="atlas-error-panel__actions">
        <button type="button" className="atlas-chip atlas-chip--active" onClick={reset}>
          Try again
        </button>
        <a href="/nutrition" className="atlas-chip">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
