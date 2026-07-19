type SessionMetricsStripProps = {
  /** Latest workout's formatted duration, e.g. "1h 48m". Real field from the backend. */
  duration: string;
  /** Latest workout's formatted distance, e.g. "14.2 km". Real field from the backend. */
  distance: string;
};

const NOT_AVAILABLE = "N/A";

/**
 * Small, compact metric tiles for time/cadence/elevation/bpm/vo2max-style session stats.
 *
 * Only "Time" and "Distance" are backed by real data the backend actually returns
 * (EnduranceWorkoutSummary.duration / .distance, sourced from synced session
 * duration_minutes/distance_km). Cadence, elevation, exercise BPM, and VO2 max have no field
 * anywhere in this backend's data model or sync payloads (checked schemas.py, service.py, and
 * every provider client) - they always render as a hardcoded "N/A" rather than a fabricated
 * number, per health-data-provider convention where unsupported metrics show as unavailable
 * instead of a guessed value.
 */
export function SessionMetricsStrip({ duration, distance }: SessionMetricsStripProps) {
  const tiles: Array<{ label: string; value: string; available: boolean }> = [
    { label: "Time", value: duration, available: true },
    { label: "Distance", value: distance, available: true },
    { label: "Cadence", value: NOT_AVAILABLE, available: false },
    { label: "Elevation", value: NOT_AVAILABLE, available: false },
    { label: "BPM", value: NOT_AVAILABLE, available: false },
    { label: "VO2 max", value: NOT_AVAILABLE, available: false }
  ];

  return (
    <section className="atlas-kpis atlas-kpis--compact" aria-label="Session metrics">
      {tiles.map((tile) => (
        <article key={tile.label} className="atlas-kpi atlas-kpi--compact">
          <div className="atlas-kpi__label">{tile.label}</div>
          <div className={`atlas-kpi__value${tile.available ? "" : " atlas-kpi__value--na"}`}>
            {tile.value}
          </div>
        </article>
      ))}
    </section>
  );
}
