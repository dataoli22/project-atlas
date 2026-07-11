import type { EnduranceSupportLink, EnduranceSupportResourceType } from "@atlas/shared";

import { CapabilityBarChart } from "@/components/capability-bar-chart";
import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { MedicalFlagBanner } from "@/components/medical-flag-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
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
      title="Capability dashboard"
      description="A snapshot of your latest workout, training timeline, and capability trend, grounded in whichever connectors you've synced."
      tags={["Endurance", "Capability", "Coaching"]}
      metrics={dashboard.cards.map((card) => ({
        label: card.label,
        value: card.value,
        trend: card.trend
      }))}
    >
      <DataSourceBanner source={source} />
      <MedicalFlagBanner flags={insights.medicalFlags} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <RefreshButton />
      </div>
      <div className="atlas-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))" }}>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Latest workout</div>
          <h2 className="atlas-panel__title" style={{ fontSize: "1.25rem" }}>
            {dashboard.latestWorkout.title}
          </h2>
          <div className="atlas-stat-grid">
            <div className="atlas-stat">
              <div className="atlas-stat__label">Duration</div>
              <div className="atlas-stat__value">{dashboard.latestWorkout.duration}</div>
            </div>
            <div className="atlas-stat">
              <div className="atlas-stat__label">Distance</div>
              <div className="atlas-stat__value">{dashboard.latestWorkout.distance}</div>
            </div>
          </div>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Coach summary</div>
          <p className="atlas-note">{dashboard.coachSummary}</p>
          <div className="atlas-panel__eyebrow">Recovery note</div>
          <p className="atlas-note">{dashboard.latestWorkout.recoveryNote}</p>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Training timeline</div>
          {timeline.entries.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              note="Connect Strava, Health Connect, or Samsung Health in Settings to start seeing training sessions here."
            />
          ) : (
            <div className="atlas-timeline">
              {timeline.entries.map((entry) => (
                <div key={`${entry.dayLabel}-${entry.sessionLabel}`} className="atlas-timeline__entry">
                  <div className="atlas-list-card__title">
                    {entry.dayLabel} | {entry.sessionLabel}
                  </div>
                  <div className="atlas-list-card__meta">
                    {entry.duration} | {entry.load} | {entry.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Capability snapshot</div>
          <p className="atlas-note">{insights.capability.headline}</p>
          <CapabilityBarChart areas={insights.capability.areas} />
          <div className="atlas-panel__eyebrow">Insights</div>
          <div className="atlas-stack">
            {insights.insights.map((insight) => (
              <div key={insight.title} className="atlas-list-card">
                <div
                  className="atlas-list-card__title"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {insight.title}
                  <span className={`atlas-priority-badge atlas-priority-badge--${insight.priority}`}>
                    {insight.priority}
                  </span>
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
