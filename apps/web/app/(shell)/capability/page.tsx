import type { EnduranceSupportLink, EnduranceSupportResourceType } from "@atlas/shared";

import { PageScaffold } from "@/components/page-scaffold";
import {
  getEnduranceDashboardData,
  getEnduranceInsightsData,
  getEnduranceTimelineData
} from "@/lib/endurance-data";
import { formatLocalizedDateTime } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

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

function getPriorityTone(priority: "high" | "medium" | "low") {
  if (priority === "high") {
    return { label: "Address next", badgeClassName: "atlas-source-badge atlas-source-badge--stub" };
  }

  if (priority === "medium") {
    return { label: "Monitor", badgeClassName: "atlas-source-badge" };
  }

  return { label: "Keep reinforcing", badgeClassName: "atlas-source-badge" };
}

export default async function CapabilityPage() {
  const [dashboard, timeline, insights, localization] = await Promise.all([
    getEnduranceDashboardData(),
    getEnduranceTimelineData(),
    getEnduranceInsightsData(),
    getLocalizationSettingsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Capability score"
      description="An explainable capability view that pairs the current score shape with the training and recovery signals already available in the endurance workspace."
      tags={["Capability", "Explainable", "Deterministic"]}
      metrics={[
        { label: "Overall signal", value: dashboard.cards[0]?.value ?? "-" },
        { label: "Recovery status", value: dashboard.cards[2]?.value ?? "-" },
        {
          label: "Updated",
          value: formatLocalizedDateTime(insights.generatedAt, localization.data, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })
        }
      ]}
    >
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Capability headline</div>
          <h2 className="atlas-panel__title" style={{ fontSize: "1.5rem" }}>
            {insights.capability.headline}
          </h2>
          <p className="atlas-note">
            The score is grounded in recent training load, support work consistency, and recovery behavior rather than a black-box summary.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Area breakdown</div>
          <div
            className="atlas-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {insights.capability.areas.map((area) => (
              <article key={area.label} className="atlas-list-card atlas-stack" style={{ gap: "12px" }}>
                <div className="atlas-list-card__title">{area.label}</div>
                <div
                  style={{
                    display: "grid",
                    gap: "10px"
                  }}
                >
                  <div
                    style={{
                      height: "10px",
                      borderRadius: "999px",
                      background: "rgba(31, 107, 92, 0.12)",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: `${area.score}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background: "linear-gradient(90deg, var(--atlas-accent), var(--atlas-warm))"
                      }}
                    />
                  </div>
                  <div className="atlas-list-card__meta">
                    <strong style={{ color: "var(--atlas-ink)" }}>{area.score}</strong> / 100 | {area.direction}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">What is shaping the score</div>
          <dl className="atlas-detail-list">
            {dashboard.cards.map((card) => (
              <div key={card.label} className="atlas-detail-list__row">
                <dt>{card.label}</dt>
                <dd>
                  {card.value}
                  {card.trend ? ` | ${card.trend}` : ""}
                </dd>
              </div>
            ))}
            <div className="atlas-detail-list__row">
              <dt>Recent training inputs</dt>
              <dd>{timeline.entries.length} logged sessions</dd>
            </div>
          </dl>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Latest workout anchor</div>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">{dashboard.latestWorkout.title}</div>
            <div className="atlas-list-card__meta">
              {dashboard.latestWorkout.duration} | {dashboard.latestWorkout.distance}
            </div>
          </div>
          <p className="atlas-note">{dashboard.latestWorkout.recoveryNote}</p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Recommended next actions</div>
          <div
            className="atlas-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {insights.insights.map((insight) => {
              const tone = getPriorityTone(insight.priority);

              return (
                <article key={insight.title} className="atlas-list-card atlas-stack" style={{ gap: "10px" }}>
                  <span className={tone.badgeClassName}>{tone.label}</span>
                  <div className="atlas-list-card__title">{insight.title}</div>
                  <div className="atlas-list-card__meta">{insight.detail}</div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="atlas-panel atlas-stack" style={{ gridColumn: "1 / -1" }}>
          <div className="atlas-panel__eyebrow">Coach support resources</div>
          <p className="atlas-note">
            These are curated, informational resources, not medical advice. Each is tagged with why it is relevant.
          </p>
          <div className="atlas-stack">
            {groupSupportLinks(insights.supportLinks).map((group) => (
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
