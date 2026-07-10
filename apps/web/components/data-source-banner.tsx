import type { ApiDataSource } from "@/lib/api";

export function DataSourceBanner({ source }: { source: ApiDataSource }) {
  if (source === "api") {
    return null;
  }

  return (
    <div className="atlas-banner atlas-banner--stale" role="status">
      <span className="atlas-banner__icon" aria-hidden="true">
        ⚠
      </span>
      <span>
        Showing local example data — Atlas couldn&apos;t reach the backend just now. Check that
        it&apos;s running, then refresh.
      </span>
    </div>
  );
}
