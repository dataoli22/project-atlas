import type { EnduranceSupportLink, EnduranceSupportResourceType } from "@atlas/shared";

import { DataSourceBanner } from "@/components/data-source-banner";
import { PageScaffold } from "@/components/page-scaffold";
import {
  getEnduranceDashboardDataWithSource,
  getEnduranceInsightsData,
  getEnduranceTimelineData
} from "@/lib/endurance-data";

const SUPPORT_RESOURCE_GROUPS: Array<{ type: EnduranceSupportResourceType; label: string }> = [
  { type: "connector-setup", label: "Connector setup" },
  { type: "recovery", label: "Recovery" },
  { type: "mobility", label: "Mobility" },
  { type: "strength", label: "Strength" },
  { type: "base-training", label: "Base training" },
  { type: "general", label: "General" }
];

function groupSupportLinks(links: EnduranceSupportLink[]) {
  return SUPPORT_RESOURCE_GROUPS.map((group) => ({
    ...group,
    links: links.filter((link) => link.resourceType === group.type)
  })).filter((group) => group.links.length > 0);
}

export default async function DashboardPage() {
  const [{ data: dashboard, source }, timeline, insights] = await Promise.all([
    getEnduranceDashboardDataWithSource(),
    getEnduranceTimelineData(),
    getEnduranceInsightsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Capability dashboard stub"
      description="This page now pulls typed stub dashboard data through a modular data access layer, so the screen can later switch to real API responses without changing the UI structure."
      tags={["Endurance", "Stub API", "Replaceable data contract"]}
      metrics={dashboard.cards.map((card) => ({
        label: card.label,
        value: card.value
      }))}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Latest workout</div>
          <h2 className="atlas-panel__title" style={{ fontSize: "1.25rem" }}>
            {dashboard.latestWorkout.title}
          </h2>
          <div className="atlas-list">
            <div className="atlas-placeholder">{dashboard.latestWorkout.duration}</div>
            <div className="atlas-placeholder">{dashboard.latestWorkout.distance}</div>
          </div>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Coach summary</div>
          <div className="atlas-placeholder">{dashboard.coachSummary}</div>
          <div className="atlas-panel__eyebrow">Recovery note</div>
          <div className="atlas-placeholder">{dashboard.latestWorkout.recoveryNote}</div>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Training timeline</div>
          <div className="atlas-stack">
            {timeline.entries.map((entry) => (
              <div key={`${entry.dayLabel}-${entry.sessionLabel}`} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {entry.dayLabel} | {entry.sessionLabel}
                </div>
                <div className="atlas-list-card__meta">
                  {entry.duration} | {entry.load} | {entry.source}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Capability snapshot</div>
          <p className="atlas-note">{insights.capability.headline}</p>
          <div className="atlas-stack">
            {insights.capability.areas.map((area) => (
              <div key={area.label} className="atlas-detail-list__row">
                <dt>{area.label}</dt>
                <dd>
                  {area.score} | {area.direction}
                </dd>
              </div>
            ))}
          </div>
          <div className="atlas-panel__eyebrow">Insights</div>
          <div className="atlas-stack">
            {insights.insights.map((insight) => (
              <div key={insight.title} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {insight.title} ({insight.priority})
                </div>
                <div className="atlas-list-card__meta">{insight.detail}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="atlas-panel atlas-stack" style={{ gridColumn: "1 / -1" }}>
          <div className="atlas-panel__eyebrow">Coach support resources</div>
          <p className="atlas-note">
            These are curated, informational resources, not medical advice. Each is tagged with why it is relevant.
          </p>
          <div className="atlas-stack">
            {groupSupportLinks(dashboard.supportLinks).map((group) => (
              <div key={group.type} className="atlas-stack" style={{ gap: "10px" }}>
                <div className="atlas-panel__eyebrow">{group.label}</div>
                <div
                  className="atlas-grid"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
                >
                  {group.links.map((link) => (
                    <article key={link.url} className="atlas-list-card atlas-stack" style={{ gap: "8px" }}>
                      <a
                        className="atlas-list-card__title"
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.title}
                      </a>
                      <div className="atlas-list-card__meta">{link.whyRecommended}</div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageScaffold>
  );
}
