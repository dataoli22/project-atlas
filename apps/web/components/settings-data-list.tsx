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
    <span className={source === "api" ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
      {label}: {source === "api" ? "API" : "Stub fallback"}
    </span>
  );
}
