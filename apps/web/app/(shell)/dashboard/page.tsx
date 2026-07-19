import Link from "next/link";
import type { EnduranceSupportLink, EnduranceSupportResourceType } from "@atlas/shared";

import { AskAtlasForm } from "@/components/ask-atlas-form";
import { AthleteNotes } from "@/components/athlete-notes";
import { CapabilityBarChart } from "@/components/capability-bar-chart";
import { CoachSupportModal } from "@/components/coach-support-modal";
import { ConnectReminderToast } from "@/components/connect-reminder-toast";
import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { EnduranceGoalForm } from "@/components/endurance-goal-form";
import { EnduranceTrainingPlan } from "@/components/endurance-training-plan";
import { HintTooltip } from "@/components/hint-tooltip";
import { MedicalFlagBanner } from "@/components/medical-flag-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import {
  getEnduranceDashboardDataWithSource,
  getEnduranceGoalData,
  getEnduranceInsightsData,
  getEnduranceTimelineData,
  getEnduranceTrainingPlanData
} from "@/lib/endurance-data";
import { getIntegrationSourcesData } from "@/lib/settings-data";

const SUPPORT_RESOURCE_GROUPS: Array<{ type: EnduranceSupportResourceType; label: string }> = [
  { type: "connector-setup", label: "Connect your apps" },
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
  const [{ data: dashboard, source }, timeline, insights, { data: integrations }, { data: goal }, { data: trainingPlan }] =
    await Promise.all([
      getEnduranceDashboardDataWithSource(),
      getEnduranceTimelineData(),
      getEnduranceInsightsData(),
      getIntegrationSourcesData(),
      getEnduranceGoalData(),
      getEnduranceTrainingPlanData()
    ]);

  const missingIntegrationLabels = integrations
    .filter((integration) => !integration.connected)
    .map((integration) => integration.title);

  return (
    <PageScaffold
      eyebrow="Endurance module"
      title="Capability dashboard"
      description="A snapshot of your latest workout, training timeline, and fitness trend, based on whichever apps you've connected."
      tags={["Endurance", "Capability", "Coaching"]}
      metrics={dashboard.cards.map((card) => ({
        label: card.label,
        value: card.value,
        trend: card.trend
      }))}
    >
      <DataSourceBanner source={source} />
      <ConnectReminderToast missingLabels={missingIntegrationLabels} />
      <MedicalFlagBanner flags={insights.medicalFlags} />

      {/* Sticky quick-jump nav, same pattern as the Cooking page, since this dashboard now stacks
          several dense sections instead of one flat grid. */}
      <nav className="atlas-section-nav" aria-label="Dashboard sections">
        <a href="#ask-atlas" className="atlas-section-nav__link">
          Ask Atlas
        </a>
        <a href="#goal-and-plan" className="atlas-section-nav__link">
          Goal &amp; plan
        </a>
        <a href="#latest-work" className="atlas-section-nav__link">
          Latest work
        </a>
        <a href="#timeline-preview" className="atlas-section-nav__link">
          Timeline
        </a>
        <a href="#coaching" className="atlas-section-nav__link">
          Coaching &amp; notes
        </a>
      </nav>

      {/* Ask Atlas is the app's core value proposition, so it (paired with Athlete Notes, the
          same horizontal layout as before) leads the page as the very first widget, ahead of the
          latest-workout hero and everything else. */}
      <div
        id="ask-atlas"
        className="atlas-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" }}
      >
        <AthleteNotes />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Ask Atlas</div>
          <p className="atlas-note">
            Ask a question grounded in this endurance data without leaving the dashboard. The same
            shared chat is also available at <Link href="/ask">/ask</Link>, and scoped mini
            versions live on the <Link href="/timeline">timeline</Link> and{" "}
            <Link href="/capability">capability</Link> pages.
          </p>
          <AskAtlasForm initialFeature="endurance" hideGroundingPanel />
        </section>
      </div>

      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <div className="atlas-toolbar">
          <Link href="/timeline" className="atlas-button">
            Full training timeline
          </Link>
          <Link href="/capability" className="atlas-button">
            Capability score detail
          </Link>
          <CoachSupportModal groups={groupSupportLinks(dashboard.supportLinks)} />
        </div>
        <RefreshButton />
      </div>

      {/* Goal selection + the deterministic training plan it drives are this page's real
          "planning/goals" widgets - distinct from the timeline's history-over-time chart and the
          capability page's current-strengths breakdown. This is the app's established "what I
          edit" surface (same reasoning as nutrition preferences living on the nutrition page),
          so goal-setting lives here rather than on timeline/capability. */}
      <section id="goal-and-plan" className="atlas-section atlas-stack">
        <div className="atlas-section__header">
          <div>
            <div className="atlas-panel__eyebrow">Endurance goal</div>
            <h2 className="atlas-section__title">Triathlon &amp; race goal planning</h2>
          </div>
        </div>
        <div className="atlas-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))" }}>
          <EnduranceGoalForm initialGoal={goal} />
          <EnduranceTrainingPlan plan={trainingPlan} />
        </div>
      </section>

      {/* Most-important-first: today's workout and the capability trend it feeds into are the two
          numbers an athlete checks first (mirrors Strava/Whoop/Garmin putting the latest activity
          and a trend readout above everything else), so they lead the page as a two-up hero pair
          instead of being just two tiles among six. */}
      <section id="latest-work" className="atlas-section atlas-stack">
        <div className="atlas-section__header">
          <div>
            <div className="atlas-panel__eyebrow">Latest workout</div>
            <h2 className="atlas-section__title">{dashboard.latestWorkout.title}</h2>
          </div>
        </div>
        {/* Real milestone badges from the actual session count and connected-app count below -
            no invented points or fake streaks, just visible facts about what's really logged. */}
        <div className="atlas-badge-row">
          <span className={`atlas-badge${timeline.entries.length >= 3 ? " atlas-badge--earned" : ""}`}>
            <span className="atlas-badge__dot" />
            {timeline.entries.length} session{timeline.entries.length === 1 ? "" : "s"} logged
          </span>
          <span className={`atlas-badge${missingIntegrationLabels.length === 0 ? " atlas-badge--earned" : ""}`}>
            <span className="atlas-badge__dot" />
            {integrations.length - missingIntegrationLabels.length} of {integrations.length} apps connected
          </span>
        </div>
        <div className="atlas-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
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
          <div className="atlas-stack">
            <div
              className="atlas-panel__eyebrow"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              Capability trend
              <HintTooltip label="How to read this chart">
                Each bar is a sub-score (0-100) feeding into your overall capability score - see
                the full breakdown on the <Link href="/capability">capability page</Link>.
              </HintTooltip>
            </div>
            <p className="atlas-note">{insights.capability.headline}</p>
            <CapabilityBarChart areas={insights.capability.areas} />
          </div>
        </div>
      </section>

      <section id="timeline-preview" className="atlas-section atlas-stack">
        <div className="atlas-section__header">
          <div>
            <div className="atlas-panel__eyebrow">Recent activity</div>
            <h2 className="atlas-section__title">Training timeline</h2>
          </div>
          <span className="atlas-section__count">
            <Link href="/timeline">See all {timeline.entries.length} sessions &rarr;</Link>
          </span>
        </div>
        {timeline.entries.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            note="Connect Strava, Health Connect, or Samsung Health in Settings to start seeing training sessions here."
          />
        ) : (
          <div className="atlas-timeline">
            {timeline.entries.slice(0, 3).map((entry) => (
              <div key={`${entry.dayLabel}-${entry.sessionLabel}`} className="atlas-timeline__entry">
                <div className="atlas-list-card__title">
                  {entry.dayLabel}: {entry.sessionLabel}
                </div>
                <div className="atlas-list-card__meta">
                  {entry.duration} of {entry.load.toLowerCase()} work &middot; captured via {entry.source}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="coaching" className="atlas-section atlas-section--warm atlas-stack">
        <div className="atlas-section__header">
          <div>
            <div
              className="atlas-panel__eyebrow"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              Coaching &amp; notes
              <HintTooltip label="Who writes this">
                Generated by Atlas from your logged data, not a human coach. For real curated
                resources, see the &quot;Coach support&quot; button above.
              </HintTooltip>
            </div>
            <h2 className="atlas-section__title">Coach summary and priority insights</h2>
          </div>
        </div>
        <div className="atlas-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <div className="atlas-stack">
            <p className="atlas-note">{dashboard.coachSummary}</p>
            <div className="atlas-panel__eyebrow">Recovery note</div>
            <p className="atlas-note">{dashboard.latestWorkout.recoveryNote}</p>
          </div>
          <div className="atlas-stack">
            <div className="atlas-panel__eyebrow">
              Insights (full breakdown on <Link href="/capability">capability</Link>)
            </div>
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
        </div>
      </section>
    </PageScaffold>
  );
}
