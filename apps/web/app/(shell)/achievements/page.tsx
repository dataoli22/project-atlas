import { CheckCircle2, Flame, Trophy } from "lucide-react";

import { DataSourceBanner } from "@/components/data-source-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import type { AchievementProgressData } from "@/lib/gamification-data";
import { getGamificationSummaryData } from "@/lib/gamification-data";

const CATEGORY_LABEL: Record<AchievementProgressData["category"], string> = {
  endurance: "Endurance",
  nutrition: "Nutrition",
  connections: "Connections"
};

const CATEGORY_ORDER: AchievementProgressData["category"][] = ["endurance", "nutrition", "connections"];

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AchievementsPage() {
  const { data: summary, source } = await getGamificationSummaryData();
  const { streak, achievements, unlockedCount, totalCount } = summary;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: achievements.filter((achievement) => achievement.category === category)
  })).filter((group) => group.items.length > 0);

  return (
    <PageScaffold
      eyebrow="Shared shell"
      title="Achievements"
      description="Real milestones drawn from your synced activities, meal swaps, and plan refreshes - nothing here is fabricated engagement, and there's no social or leaderboard layer since Atlas is single-user and local-first."
      tags={["Achievements", "Local-first"]}
      metrics={[
        { label: "Unlocked", value: `${unlockedCount} / ${totalCount}` },
        { label: "Current streak", value: `${streak.currentStreakDays} day${streak.currentStreakDays === 1 ? "" : "s"}` },
        { label: "Longest streak", value: `${streak.longestStreakDays} day${streak.longestStreakDays === 1 ? "" : "s"}` }
      ]}
    >
      <DataSourceBanner source={source} />

      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Flame size={16} strokeWidth={2} aria-hidden="true" />
          Activity streak
        </div>
        <p className="atlas-note">
          Counts consecutive days with at least one synced activity from a connected health app
          (Strava, Health Connect, or Samsung Health). It breaks if a full day passes with nothing
          synced - there is no freeze/grace mechanic yet, and no penalty beyond the counter
          resetting.
        </p>
        <div className="atlas-stat-grid">
          <div className="atlas-stat">
            <div className="atlas-stat__label">Current streak</div>
            <div className="atlas-stat__value">{streak.currentStreakDays}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Longest streak</div>
            <div className="atlas-stat__value">{streak.longestStreakDays}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Last active</div>
            <div className="atlas-stat__value" style={{ fontSize: "1.1rem" }}>
              {formatDate(streak.lastActiveDate) ?? "No activity yet"}
            </div>
          </div>
        </div>
        {streak.currentStreakDays === 0 ? (
          <p className="atlas-note">
            No active streak right now - sync an activity from a connected health app to start one.
            Connect one under Settings &rarr; Setup.
          </p>
        ) : null}
      </section>

      <div className="atlas-toolbar" style={{ justifyContent: "flex-end" }}>
        <RefreshButton />
      </div>

      {grouped.length === 0 ? (
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Trophy size={16} strokeWidth={2} aria-hidden="true" />
            Achievements
          </div>
          <p className="atlas-note">
            Nothing to show yet - connect a health app and log some activity or meal swaps to
            start unlocking achievements.
          </p>
        </section>
      ) : (
        grouped.map((group) => (
          <section key={group.category} className="atlas-section atlas-stack">
            <div className="atlas-section__header">
              <div>
                <div className="atlas-panel__eyebrow">{group.label}</div>
                <h2 className="atlas-section__title">
                  {group.items.filter((item) => item.unlocked).length} / {group.items.length} unlocked
                </h2>
              </div>
            </div>
            <div className="atlas-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
              {group.items.map((achievement) => {
                const percent = Math.min(
                  100,
                  Math.round((achievement.progressCurrent / achievement.progressTarget) * 100)
                );
                return (
                  <div
                    key={achievement.id}
                    className={achievement.unlocked ? "atlas-list-card atlas-list-card--unlocked" : "atlas-list-card"}
                  >
                    <div
                      className="atlas-list-card__title"
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {achievement.unlocked ? (
                        <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" color="var(--atlas-accent)" />
                      ) : null}
                      {achievement.title}
                    </div>
                    <div className="atlas-list-card__meta">{achievement.description}</div>
                    <div className="atlas-progress-track" style={{ marginTop: "6px" }}>
                      <div className="atlas-progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="atlas-list-card__meta">
                      {achievement.unlocked
                        ? `Unlocked ${formatDate(achievement.unlockedAt) ?? ""}`
                        : `${Math.floor(achievement.progressCurrent)} / ${achievement.progressTarget}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </PageScaffold>
  );
}
