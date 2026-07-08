type PlaceholderPanelsProps = {
  primaryLabel: string;
  primaryText: string;
  secondaryLabel: string;
  secondaryText: string;
};

export function PlaceholderPanels({
  primaryLabel,
  primaryText,
  secondaryLabel,
  secondaryText
}: PlaceholderPanelsProps) {
  return (
    <div className="atlas-grid atlas-grid--hero">
      <section className="atlas-panel">
        <div className="atlas-panel__eyebrow">{primaryLabel}</div>
        <div className="atlas-placeholder">{primaryText}</div>
      </section>
      <section className="atlas-panel">
        <div className="atlas-panel__eyebrow">{secondaryLabel}</div>
        <div className="atlas-placeholder">{secondaryText}</div>
      </section>
    </div>
  );
}
