import Link from "next/link";

import { AskAtlasForm } from "@/components/ask-atlas-form";
import { CapabilityBarChart } from "@/components/capability-bar-chart";
import { HintTooltip } from "@/components/hint-tooltip";
import { DataSourceBanner } from "@/components/data-source-banner";
import { DisciplineSplitTable } from "@/components/discipline-split-table";
import { MedicalFlagBanner } from "@/components/medical-flag-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";
import {
  getEnduranceDashboardDataWithSource,
  getEnduranceDisciplineKpiData,
  getEnduranceInsightsDataWithSource,
  getEnduranceTimelineDataWithSource
} from "@/lib/endurance-data";
import { formatLocalizedDateTime } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

const PRIORITY_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "Address next",
  medium: "Monitor",
  low: "Keep reinforcing"
};

export default async function CapabilityPage() {
  const [
    { data: dashboard, source: dashboardSource },
    { source: timelineSource },
    { data: insights, source: insightsSource },
    localization,
    { data: disciplineKpis }
  ] = await Promise.all([
    getEnduranceDashboardDataWithSource(),
    getEnduranceTimelineDataWithSource(),
    getEnduranceInsightsDataWithSource(),
    getLocalizationSettingsData(),
    getEnduranceDisciplineKpiData()
  ]);
  const source = combineDataSources(dashboardSource, timelineSource, insightsSource);

  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Capability score"
      description="An explainable capability view that pairs the current score shape with the training and recovery signals already available in the endurance workspace. Dashboard cards, the latest workout, and support resources live on the dashboard - this page stays focused on the score breakdown itself."
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
      <DataSourceBanner source={source} />
      <MedicalFlagBanner flags={insights.medicalFlags} />
      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <div className="atlas-toolbar">
          <Link href="/dashboard" className="atlas-button">
            Back to dashboard
          </Link>
          <Link href="/timeline" className="atlas-button">
            Full training timeline
          </Link>
        </div>
        <RefreshButton />
      </div>
      {/* Ask Atlas is the app's core value proposition, so it leads the page content, ahead of
          the capability headline/breakdown/actions sections below. */}
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Ask Atlas about this score</div>
        <p className="atlas-note">
          Ask why an area scored the way it did, or what would move it. This is the same shared
          endurance-scoped Ask Atlas assistant used on the <Link href="/dashboard">dashboard</Link>{" "}
          and <Link href="/ask">/ask</Link>, placed here for capability-specific questions.
        </p>
        <AskAtlasForm initialFeature="endurance" hideGroundingPanel />
      </section>

      {/* Capability's real "current strengths by discipline" widget - a compact table comparing
          real run/bike/swim totals, distinct from Dashboard's current-state hero cards and
          Timeline's weekly-volume-over-time chart. */}
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Discipline split (triathlon KPIs)</div>
        <p className="atlas-note">
          Real totals per discipline, grouped from your actual synced sessions&apos; sport type -
          a discipline with no synced sessions in a window is left out rather than shown as zero.
        </p>
        <DisciplineSplitTable
          week={disciplineKpis.week}
          month={disciplineKpis.month}
          hasRealSessions={disciplineKpis.hasRealSessions}
        />
      </section>

      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Capability headline</div>
          <h2 className="atlas-panel__title" style={{ fontSize: "1.5rem" }}>
            {insights.capability.headline}
          </h2>
          <p className="atlas-note">
            This score is based on your recent training load, how consistent your supporting workouts have been, and
            your recovery habits - not a mystery number, every part of it is explained below.
          </p>
          <span
            className={
              insights.capability.confidence === "high"
                ? "atlas-source-badge"
                : "atlas-source-badge atlas-source-badge--stub"
            }
          >
            Confidence: {insights.capability.confidence} — {insights.capability.confidenceNote}
          </span>
          <HintTooltip label="What confidence means">
            How fresh the data behind this score is - low confidence means your connected apps
            haven&apos;t synced recently, not that the score itself is bad.
          </HintTooltip>
        </section>

        <section className="atlas-panel atlas-stack">
          <div
            className="atlas-panel__eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            Area breakdown
            <HintTooltip label="How to read this chart">
              Each bar is a sub-score (0-100) feeding into the overall capability score above -
              training load, consistency, and recovery.
            </HintTooltip>
          </div>
          <CapabilityBarChart areas={insights.capability.areas} />
        </section>

        <section className="atlas-panel atlas-stack" style={{ gridColumn: "1 / -1" }}>
          <div
            className="atlas-panel__eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            Recommended next actions
            <HintTooltip label="What the priority labels mean">
              &quot;Address next&quot; = look at this first. &quot;Monitor&quot; = worth keeping
              an eye on. &quot;Keep reinforcing&quot; = lower urgency, background context.
            </HintTooltip>
          </div>
          <div
            className="atlas-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {insights.insights.map((insight) => (
              <article key={insight.title} className="atlas-list-card atlas-stack" style={{ gap: "10px" }}>
                <span className={`atlas-priority-badge atlas-priority-badge--${insight.priority}`}>
                  {PRIORITY_LABEL[insight.priority]}
                </span>
                <div className="atlas-list-card__title">{insight.title}</div>
                <div className="atlas-list-card__meta">{insight.detail}</div>
              </article>
            ))}
          </div>
          <p className="atlas-note">
            Cards, latest workout, and curated support resources for these actions are on the{" "}
            <Link href="/dashboard">dashboard</Link>.
          </p>
        </section>
      </div>
    </PageScaffold>
  );
}
