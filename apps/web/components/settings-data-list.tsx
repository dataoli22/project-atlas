type SettingsDataListProps = {
  items: Array<{
    label: string;
    value: string;
  }>;
};

export function SettingsDataList({ items }: SettingsDataListProps) {
  return (
    <dl className="atlas-detail-list">
      {items.map((item) => (
        <div key={item.label} className="atlas-detail-list__row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type DataSourceBadgeProps = {
  label: string;
  source: "api" | "stub";
};

export function DataSourceBadge({ label, source }: DataSourceBadgeProps) {
  return (
    <span
      className={source === "api" ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}
      title={
        source === "api"
          ? "Loaded from the local Atlas app on this device"
          : "The local Atlas app wasn't reachable, so this is example data, not your real data"
      }
    >
      {label}: {source === "api" ? "Live" : "Offline default"}
    </span>
  );
}
