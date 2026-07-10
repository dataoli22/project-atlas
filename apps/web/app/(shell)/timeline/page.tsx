import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { PageScaffold } from "@/components/page-scaffold";
import { combineDataSources } from "@/lib/data-source";
import {
  getEnduranceDashboardDataWithSource,
  getEnduranceInsightsDataWithSource,
  getEnduranceTimelineDataWithSource
} from "@/lib/endurance-data";
import { formatLocalizedDateTime } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

function getSourceLabel(source: string) {
  return source.replace(/-stub$/i, "").replace(/-/g, " ");
}

export default async function TimelinePage() {
  const [{ data: dashboard, source: dashboardSource }, { data: timeline, source: timelineSource }, { data: insights, source: insightsSource }, localization] =
    await Promise.all([
      getEnduranceDashboardDataWithSource(),
      getEnduranceTimelineDataWithSource(),
      getEnduranceInsightsDataWithSource(),
      getLocalizationSettingsData()
    ]);
  const source = combineDataSources(dashboardSource, timelineSource, insightsSource);

  const sessionCount = timeline.entries.length;
  const sources = Array.from(new Set(timeline.entries.map((entry) => getSourceLabel(entry.source))));
  const highlightedInsight = insights.insights.find((insight) => insight.priority === "high") ?? insights.insights[0];

  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Training timeline"
      description="A unified endurance feed for recent sessions, support work, and recovery context so you can review the training story in one pass on phone or desktop."
      tags={["Endurance", "Timeline", "Recovery context"]}
      metrics={[
        { label: "Sessions logged", value: String(sessionCount) },
        { label: "Latest session", value: dashboard.latestWorkout.title },
        {
          label: "Updated",
          value: formatLocalizedDateTime(timeline.generatedAt, localization.data, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })
        }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Chronology</div>
          <p className="atlas-note">
            Recent work is shown in sequence with the load language and capture source already provided by the endurance data layer.
          </p>
          {timeline.entries.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              note="Connect Strava, Health Connect, or Samsung Health in Settings to start building this timeline."
            />
          ) : (
            <div className="atlas-stack">
              {timeline.entries.map((entry, index) => (
                <article
                  key={`${entry.dayLabel}-${entry.sessionLabel}`}
                  className="atlas-list-card"
                  style={{
                    gridTemplateColumns: "minmax(0, 88px) minmax(0, 1fr)",
                    alignItems: "start",
                    gap: "14px"
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "6px",
                      alignContent: "start"
                    }}
                  >
                    <div className="atlas-source-badge">{entry.dayLabel}</div>
                    <div className="atlas-note">#{String(index + 1).padStart(2, "0")}</div>
                  </div>
                  <div className="atlas-stack" style={{ gap: "10px" }}>
                    <div>
                      <div className="atlas-list-card__title">{entry.sessionLabel}</div>
                      <div className="atlas-list-card__meta">
                        {entry.duration} of work with a {entry.load.toLowerCase()} emphasis.
                      </div>
                    </div>
                    <dl className="atlas-detail-list">
                      <div className="atlas-detail-list__row">
                        <dt>Load</dt>
                        <dd>{entry.load}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Captured via</dt>
                        <dd>{getSourceLabel(entry.source)}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Review focus</div>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">Coach summary</div>
            <div className="atlas-list-card__meta">{dashboard.coachSummary}</div>
          </div>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">Priority cue</div>
            <div className="atlas-list-card__meta">
              {highlightedInsight.title}: {highlightedInsight.detail}
            </div>
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Signal coverage</div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Capture sources</dt>
              <dd>{sources.length}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Supporting systems</dt>
              <dd>{sources.join(", ")}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Recovery note</dt>
              <dd>{dashboard.latestWorkout.recoveryNote}</dd>
            </div>
          </dl>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Capability context</div>
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
        </section>
      </div>
    </PageScaffold>
  );
}
