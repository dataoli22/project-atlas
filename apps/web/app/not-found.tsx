import Link from "next/link";

export default function NotFound() {
  return (
    <div className="atlas-error-panel">
      <div>
        <div className="atlas-panel__eyebrow">404</div>
        <h1 className="atlas-panel__title" style={{ fontSize: "1.4rem" }}>
          This page doesn&apos;t exist
        </h1>
        <p className="atlas-brand__summary">
          The link you followed might be out of date, or the page moved.
        </p>
      </div>
      <div className="atlas-error-panel__actions">
        <Link href="/nutrition" className="atlas-chip atlas-chip--active">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
