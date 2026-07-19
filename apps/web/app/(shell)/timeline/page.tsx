import Link from "next/link";

import { AskAtlasForm } from "@/components/ask-atlas-form";
import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { HintTooltip } from "@/components/hint-tooltip";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import { WeeklyVolumeTrendChart } from "@/components/weekly-volume-trend-chart";
import { combineDataSources } from "@/lib/data-source";
import {
  getEnduranceDashboardDataWithSource,
  getEnduranceInsightsDataWithSource,
  getEnduranceTimelineDataWithSource,
  getEnduranceWeeklyVolumeTrendData
} from "@/lib/endurance-data";
import { formatLocalizedDateTime } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

function getSourceLabel(source: string) {
  return source.replace(/-stub$/i, "").replace(/-/g, " ");
}

export default async function TimelinePage() {
  const [
    { data: dashboard, source: dashboardSource },
    { data: timeline, source: timelineSource },
    { source: insightsSource },
    localization,
    { data: weeklyVolumeTrend }
  ] = await Promise.all([
    getEnduranceDashboardDataWithSource(),
    getEnduranceTimelineDataWithSource(),
    getEnduranceInsightsDataWithSource(),
    getLocalizationSettingsData(),
    getEnduranceWeeklyVolumeTrendData()
  ]);
  const source = combineDataSources(dashboardSource, timelineSource, insightsSource);

  const sessionCount = timeline.entries.length;
  const sources = Array.from(new Set(timeline.entries.map((entry) => getSourceLabel(entry.source))));

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
      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <div className="atlas-toolbar">
          <Link href="/dashboard" className="atlas-button">
            Back to dashboard
          </Link>
          <Link href="/capability" className="atlas-button">
            Capability score detail
          </Link>
        </div>
        <RefreshButton />
      </div>
      {/* Ask Atlas is the app's core value proposition, so it leads the page content, ahead of
          the recent-sessions and data-source sections below. */}
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Ask Atlas about this timeline</div>
        <p className="atlas-note">
          Ask about pacing, load trends, or what to do next based on the sessions below. This is
          the same shared endurance-scoped Ask Atlas assistant used on the{" "}
          <Link href="/dashboard">dashboard</Link> and <Link href="/ask">/ask</Link>, placed here
          for timeline-specific questions.
        </p>
        <AskAtlasForm initialFeature="endurance" hideGroundingPanel />
      </section>

      {/* Timeline's real "history over time" widget - a weekly-distance bar trend built from
          actual synced session history, distinct from Dashboard's current-state hero cards and
          Capability's per-discipline snapshot table. */}
      <section className="atlas-panel atlas-stack">
        <div
          className="atlas-panel__eyebrow"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          Weekly training volume
          <HintTooltip label="What this chart shows">
            Total distance per week, added up from your synced sessions - a quick way to spot
            whether volume is climbing, flat, or dropping.
          </HintTooltip>
        </div>
        {weeklyVolumeTrend.hasRealSessions ? (
          <WeeklyVolumeTrendChart weeks={weeklyVolumeTrend.weeks} />
        ) : (
          <p className="atlas-note">
            No synced session history yet, so there is no real weekly trend to show. Connect
            Strava or Health Connect in Settings to start building this chart.
          </p>
        )}
      </section>

      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div
            className="atlas-panel__eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            Recent sessions
            <HintTooltip label='What "emphasis" means'>
              For real synced sessions, this is the workout type your connected app reported (e.g.
              Run, Ride). Example data shows an illustrative intensity label instead.
            </HintTooltip>
          </div>
          <p className="atlas-note">
            Your recent workouts in order, with how hard each one was and where it came from.
          </p>
          {timeline.entries.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              note="Connect Strava, Health Connect, or Samsung Health in Settings to start building this timeline."
            />
          ) : (
            <div className="atlas-timeline">
              {timeline.entries.map((entry, index) => (
                <div key={`${entry.dayLabel}-${entry.sessionLabel}`} className="atlas-timeline__entry">
                  <div className="atlas-list-card__title">
                    #{String(index + 1).padStart(2, "0")} - {entry.dayLabel} - {entry.sessionLabel}
                  </div>
                  <div className="atlas-list-card__meta">
                    {entry.duration} of work with a {entry.load.toLowerCase()} emphasis
                  </div>
                  <div className="atlas-list-card__meta">Captured via {getSourceLabel(entry.source)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Where this data comes from</div>
          <p className="atlas-note">
            The coach summary and top priorities now live only on the{" "}
            <Link href="/dashboard">dashboard</Link>; the fitness score breakdown behind these
            sessions is on the <Link href="/capability">capability page</Link>.
          </p>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Connected apps</dt>
              <dd>{sources.length}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Which ones</dt>
              <dd>{sources.join(", ")}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Recovery note</dt>
              <dd>{dashboard.latestWorkout.recoveryNote}</dd>
            </div>
          </dl>
        </section>
      </div>

    </PageScaffold>
  );
}
