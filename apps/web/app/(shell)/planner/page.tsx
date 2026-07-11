import { revalidatePath } from "next/cache";

import { CalendarTimeFilter } from "@/components/calendar-time-filter";
import { CuisineSwitcher } from "@/components/cuisine-switcher";
import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";
import {
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getNutritionSubstitutionsDataWithSource,
  refreshNutritionPlan
} from "@/lib/nutrition-data";
import { getLocalizationSettingsData, getMarketOptionsData } from "@/lib/settings-data";
import type { NutritionPlanStatus } from "@atlas/shared";

const STATUS_LABEL: Record<NutritionPlanStatus, string> = {
  current: "Current",
  refreshing: "Refreshing",
  stale: "Stale - refresh due",
  failed: "Last refresh failed"
};

function daysUntil(iso: string): number {
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) {
    return 0;
  }
  return Math.round((due - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function refreshPlanAction(formData: FormData) {
  "use server";
  const reason = formData.get("reason")?.toString();
  await refreshNutritionPlan(reason);
  revalidatePath("/planner");
}

export default async function PlannerPage() {
  const [
    { data: planner, source: plannerSource },
    { data: shoppingList, source: shoppingListSource },
    { data: substitutions, source: substitutionsSource },
    { data: localization },
    { data: markets }
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionShoppingListDataWithSource(),
    getNutritionSubstitutionsDataWithSource(),
    getLocalizationSettingsData(),
    getMarketOptionsData()
  ]);
  const source = combineDataSources(plannerSource, shoppingListSource, substitutionsSource);

  const { refresh } = planner;
  const remaining = daysUntil(refresh.refreshDueAt);

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Weekly planner"
      description="A seven-day calendar plan that refreshes every seven days. Batch anchors, leftover carryover, meal-prep hacks, and curated prep videos are surfaced inline so the week stays low-cost and low-friction."
      tags={["Nutrition", "Seven-day calendar", "Refreshable plan"]}
      metrics={[
        { label: "Week", value: planner.weekLabel },
        { label: "Budget", value: planner.budget },
        { label: "Projected spend", value: planner.projectedSpend }
      ]}
    >
      <DataSourceBanner source={source} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <CuisineSwitcher localization={localization} markets={markets} />
        <RefreshButton />
      </div>
      <div className="atlas-grid">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Plan status</div>
          <div className="atlas-meta">
            <span>Status: {STATUS_LABEL[refresh.status]}</span>
            <span>Version {refresh.plannerVersion}</span>
          </div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Plan window</dt>
              <dd>
                {formatDate(refresh.weekStartDate)} - {formatDate(refresh.weekEndDate)}
              </dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Refreshes every</dt>
              <dd>{refresh.refreshIntervalDays} days</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Next refresh due</dt>
              <dd>
                {formatDate(refresh.refreshDueAt)}
                {refresh.isStale
                  ? " (overdue)"
                  : remaining >= 0
                    ? ` (in ${remaining} day${remaining === 1 ? "" : "s"})`
                    : ""}
              </dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Last refreshed</dt>
              <dd>{formatDate(refresh.lastRefreshedAt)}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Reason</dt>
              <dd>{refresh.refreshReason}</dd>
            </div>
          </dl>
          <p className="atlas-note">{refresh.dataFreshness}</p>
          <form action={refreshPlanAction} className="atlas-stack" style={{ gap: "8px" }}>
            <label className="atlas-panel__eyebrow" htmlFor="refresh-reason">
              Refresh this plan now
            </label>
            <input
              id="refresh-reason"
              name="reason"
              placeholder="Why refresh? e.g. ran out of paneer"
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid var(--atlas-border)",
                background: "var(--atlas-surface-strong)",
                color: "var(--atlas-ink)"
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                background: "var(--atlas-accent)",
                color: "#fffdf7",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Refresh plan
            </button>
            <span className="atlas-note">
              The previous plan is preserved in swap history instead of being overwritten.
            </span>
          </form>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Planner summary</div>
          <p className="atlas-note">{planner.plannerSummary}</p>
          <div className="atlas-panel__eyebrow">Execution lane</div>
          <div className="atlas-stat-grid">
            <div className="atlas-stat">
              <div className="atlas-stat__label">Schedule</div>
              <div className="atlas-stat__value">{planner.scheduleLabel}</div>
            </div>
            <div className="atlas-stat">
              <div className="atlas-stat__label">Cooking cadence</div>
              <div className="atlas-stat__value">{planner.cookingCadence}</div>
            </div>
            <div className="atlas-stat">
              <div className="atlas-stat__label">Batch day</div>
              <div className="atlas-stat__value">{planner.batchDay}</div>
            </div>
          </div>
          <div className="atlas-panel__eyebrow">Swap history</div>
          {planner.swapHistory.length > 0 ? (
            <div className="atlas-stack">
              {planner.swapHistory.map((entry, index) => (
                <div key={`${entry.refreshedAt}-${index}`} className="atlas-list-card">
                  <div className="atlas-list-card__title">{entry.reason}</div>
                  <div className="atlas-list-card__meta">
                    {formatDate(entry.refreshedAt)} | {entry.summary}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No refreshes yet"
              note="Once you refresh this plan, the previous week is preserved here instead of being discarded."
            />
          )}
        </section>
      </div>

      <section className="atlas-panel atlas-stack" style={{ marginTop: "20px" }}>
        <div className="atlas-panel__eyebrow">Seven-day calendar</div>
        <p className="atlas-note">
          Batch days are outlined; leftover meals show where they carried over from. Filter by how long a
          day&apos;s cook time runs, or scroll for the full week.
        </p>
        <CalendarTimeFilter calendarDays={planner.calendarDays} />
      </section>

      <div className="atlas-grid" style={{ marginTop: "20px" }}>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Meal prep hacks</div>
          <div className="atlas-stack">
            {planner.mealPrepHacks.map((hack) => (
              <div key={hack.title} className="atlas-list-card">
                <div className="atlas-list-card__title">{hack.title}</div>
                <div className="atlas-list-card__meta">{hack.detail}</div>
                <div className="atlas-list-card__meta">
                  Days: {hack.appliesToDays.join(", ") || "Any"} | Saves ~
                  {hack.estimatedTimeSavedMinutes} min | {hack.difficulty}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Prep videos</div>
          <p className="atlas-note">Curated searches to help execute the week. Opens on YouTube.</p>
          <div className="atlas-stack">
            {planner.videoLinks.map((video) => (
              <a
                key={video.url}
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="atlas-list-card"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div className="atlas-list-card__title">{video.title}</div>
                <div className="atlas-list-card__meta">
                  {video.topic} | scope: {video.marketScope}
                </div>
                <div className="atlas-list-card__meta">{video.whyRecommended}</div>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="atlas-grid" style={{ marginTop: "20px" }}>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Shopping list</div>
          <div className="atlas-meta">
            <span>{shoppingList.totalItems} items</span>
            <span>{shoppingList.estimatedTotal}</span>
          </div>
          <div className="atlas-stack">
            {shoppingList.items.map((item) => (
              <div key={`${item.name}-${item.quantity}`} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {item.name} | {item.quantity}
                </div>
                <div className="atlas-list-card__meta">
                  {item.category} | {item.estimatedCost} | {item.priority} priority
                </div>
                <div className="atlas-list-card__meta">Used in: {item.usedInDays.join(", ")}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Substitutions</div>
          <p className="atlas-note">{substitutions.marketNote}</p>
          <div className="atlas-stack">
            {substitutions.substitutions.map((item) => (
              <div key={item.ingredient} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {item.ingredient} {"->"} {item.substitute}
                </div>
                <div className="atlas-list-card__meta">
                  {item.reason} | {item.budgetImpact} | {item.swapCategory}
                </div>
                {item.nutrientComparison ? (
                  <div className="atlas-list-card__meta">{item.nutrientComparison}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageScaffold>
  );
}
