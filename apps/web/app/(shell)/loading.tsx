export default function ShellLoading() {
  return (
    <div className="atlas-loading-skeleton" aria-busy="true" aria-label="Loading">
      <div className="atlas-loading-skeleton__block" style={{ height: 96 }} />
      <div className="atlas-grid--hero" style={{ display: "grid" }}>
        <div className="atlas-loading-skeleton__block" style={{ height: 88 }} />
        <div className="atlas-loading-skeleton__block" style={{ height: 88 }} />
        <div className="atlas-loading-skeleton__block" style={{ height: 88 }} />
      </div>
      <div className="atlas-loading-skeleton__block" style={{ height: 220 }} />
      <div className="atlas-loading-skeleton__block" style={{ height: 160 }} />
    </div>
  );
}
