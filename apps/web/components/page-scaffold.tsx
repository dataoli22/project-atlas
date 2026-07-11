import type { ReactNode } from "react";

import { TrendBadge } from "@/components/trend-badge";

type PageScaffoldProps = {
  eyebrow: string;
  title: string;
  description: string;
  tags?: string[];
  metrics?: Array<{
    label: string;
    value: string;
    trend?: string;
  }>;
  children?: ReactNode;
};

export function PageScaffold({
  eyebrow,
  title,
  description,
  tags = [],
  metrics = [],
  children
}: PageScaffoldProps) {
  return (
    <div className="atlas-grid">
      <section className="atlas-panel">
        <div className="atlas-panel__eyebrow">{eyebrow}</div>
        <h1 className="atlas-panel__title">{title}</h1>
        <p className="atlas-brand__summary">{description}</p>
        <div className="atlas-meta">
          {tags.map((tag) => (
            <span key={tag} className="atlas-tag">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {metrics.length > 0 ? (
        <section className="atlas-kpis" aria-label="Key metrics">
          {metrics.map((metric) => (
            <article key={metric.label} className="atlas-kpi">
              <div className="atlas-kpi__label">{metric.label}</div>
              <div className="atlas-kpi__value">{metric.value}</div>
              {metric.trend ? <TrendBadge text={metric.trend} /> : null}
            </article>
          ))}
        </section>
      ) : null}

      {children}
    </div>
  );
}
