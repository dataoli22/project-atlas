type EmptyStateProps = {
  title: string;
  note: string;
};

/** For "you have no data yet" - genuinely zero real items, not a fetch failure (see
 * DataSourceBanner for that case) and not a placeholder for an unbuilt feature (see
 * PlaceholderPanels for that case). Reuses the existing .atlas-placeholder dashed-box style
 * already used elsewhere in the app for this same visual language. */
export function EmptyState({ title, note }: EmptyStateProps) {
  return (
    <div className="atlas-placeholder" style={{ minHeight: 96 }}>
      <div>
        <div className="atlas-list-card__title">{title}</div>
        <div className="atlas-list-card__meta">{note}</div>
      </div>
    </div>
  );
}
