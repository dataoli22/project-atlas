import Link from "next/link";
import { revalidatePath } from "next/cache";

import { CalendarTimeFilter } from "@/components/calendar-time-filter";
import { CuisineSwitcher } from "@/components/cuisine-switcher";
import { DataSourceBanner } from "@/components/data-source-banner";
import { EmptyState } from "@/components/empty-state";
import { HintTooltip } from "@/components/hint-tooltip";
import { NutritionPreferencesForm } from "@/components/nutrition-preferences-form";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";
import {
  getNutritionPlannerDataWithSource,
  getNutritionPreferencesData,
  getNutritionSubstitutionsDataWithSource,
  refreshNutritionPlan,
  searchNutritionProducts
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
    { data: preferences },
    { data: substitutions, source: substitutionsSource },
    { data: localization },
    { data: markets },
    productSearch
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionPreferencesData(),
    getNutritionSubstitutionsDataWithSource(),
    getLocalizationSettingsData(),
    getMarketOptionsData(),
    searchNutritionProducts("oats", 3)
  ]);
  const source = combineDataSources(plannerSource, substitutionsSource);

  const { refresh } = planner;
  const remaining = daysUntil(refresh.refreshDueAt);
  const plannedDayCount = planner.meals.filter((meal) => meal.breakfast || meal.lunch || meal.dinner).length;
  const totalDayCount = planner.meals.length;

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Weekly planner"
      description="A seven-day calendar plan that refreshes every seven days. Batch anchors and leftover carryover are surfaced inline; meal-prep hacks and curated prep videos live on the cooking flow."
      tags={["Nutrition", "Seven-day calendar", "Refreshable plan"]}
      metrics={[
        { label: "Week", value: planner.weekLabel },
        { label: "Budget", value: planner.budget },
        { label: "Projected spend", value: planner.projectedSpend }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <CuisineSwitcher localization={localization} markets={markets} />
        <div className="atlas-toolbar">
          <Link href="/cooking" className="atlas-button">
            Go to cooking flow
          </Link>
          <Link href="/shopping" className="atlas-button">
            Go to pantry
          </Link>
          <RefreshButton />
        </div>
      </div>

      {/* Chronology, top to bottom, per product direction: 1) preferences (incl. free-text
          planning note + health conditions/allergens), 2) merged plan status + summary
          (compact - collapsed unit), 3) substitutions (right after the collapsed unit),
          4) seven-day calendar with links to planner/cooking. */}
      <nav className="atlas-section-nav" aria-label="Jump to section">
        <a className="atlas-section-nav__link" href="#plan-status">Plan status</a>
        <a className="atlas-section-nav__link" href="#substitutions">Substitutions</a>
        <a className="atlas-section-nav__link" href="#seven-day-calendar">This week</a>
        <a className="atlas-section-nav__link" href="#ingredient-data">Ingredient lookup</a>
      </nav>

      <NutritionPreferencesForm initialPreferences={preferences} />

      <section id="plan-status" className="atlas-panel atlas-section atlas-stack" style={{ marginTop: "20px" }}>
        <div
          className="atlas-panel__eyebrow"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          Plan status &amp; summary
          <HintTooltip label="Status and version">
            Plans refresh automatically on a set interval (see below), or anytime you trigger one
            manually. Version goes up by one each time the plan is regenerated.
          </HintTooltip>
        </div>
        <div className="atlas-meta">
          <span>Status: {STATUS_LABEL[refresh.status]}</span>
          <span>Version {refresh.plannerVersion}</span>
          <span>
            {formatDate(refresh.weekStartDate)} - {formatDate(refresh.weekEndDate)}
          </span>
          <span>
            Next refresh {formatDate(refresh.refreshDueAt)}
            {refresh.isStale
              ? " (overdue)"
              : remaining >= 0
                ? ` (in ${remaining} day${remaining === 1 ? "" : "s"})`
                : ""}
          </span>
        </div>
        <p className="atlas-note">{planner.plannerSummary}</p>
        {/* Real progress toward this week's actual plan (same "days with a meal filled in" count
            used on the pantry page) plus a milestone badge for a real, checkable fact: every day
            of the week has meals scheduled. No invented points or streaks. */}
        <div className="atlas-progress">
          <div className="atlas-progress__label">
            <span>Week scheduled</span>
            <span>{plannedDayCount} of {totalDayCount} days</span>
          </div>
          <div className="atlas-progress__track">
            <div
              className={`atlas-progress__fill${plannedDayCount >= totalDayCount ? " atlas-progress__fill--complete" : ""}`}
              style={{ width: `${totalDayCount > 0 ? Math.round((plannedDayCount / totalDayCount) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div className="atlas-badge-row">
          <span className={`atlas-badge${plannedDayCount >= totalDayCount ? " atlas-badge--earned" : ""}`}>
            <span className="atlas-badge__dot" />
            {plannedDayCount >= totalDayCount ? "Full week scheduled" : "Still filling in the week"}
          </span>
          {planner.swapHistory.length > 0 ? (
            <span className="atlas-badge atlas-badge--earned">
              <span className="atlas-badge__dot" />
              {planner.swapHistory.length} past {planner.swapHistory.length === 1 ? "plan" : "plans"} kept in your history
            </span>
          ) : null}
        </div>
        <div className="atlas-stat-grid">
          <div className="atlas-stat">
            <div className="atlas-stat__label">Schedule</div>
            <div className="atlas-stat__value">{planner.scheduleLabel}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Cooking rhythm</div>
            <div className="atlas-stat__value">{planner.cookingCadence}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Batch day</div>
            <div className="atlas-stat__value">{planner.batchDay}</div>
          </div>
        </div>

        <details>
          <summary className="atlas-note" style={{ cursor: "pointer" }}>
            More plan detail (refresh reason, data freshness, swap history)
          </summary>
          <div className="atlas-stack" style={{ marginTop: "10px" }}>
            <dl className="atlas-detail-list">
              <div className="atlas-detail-list__row">
                <dt>Refreshes every</dt>
                <dd>{refresh.refreshIntervalDays} days</dd>
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
            <form action={refreshPlanAction} className="atlas-stack">
              <label className="atlas-form-field">
                <span>Refresh this plan now</span>
                <input id="refresh-reason" name="reason" placeholder="Why refresh? e.g. ran out of paneer" />
              </label>
              <button type="submit" className="atlas-button atlas-button--primary">
                Refresh plan
              </button>
              <span className="atlas-note">
                The previous plan is preserved in swap history instead of being overwritten.
              </span>
            </form>
            <div className="atlas-panel__eyebrow">Swap history</div>
            {planner.swapHistory.length > 0 ? (
              <div className="atlas-stack">
                {planner.swapHistory.map((entry, index) => (
                  <div key={`${entry.refreshedAt}-${index}`} className="atlas-list-card">
                    <div className="atlas-list-card__title">{entry.reason}</div>
                    <div className="atlas-list-card__meta">{formatDate(entry.refreshedAt)}</div>
                    <div className="atlas-list-card__meta">{entry.summary}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No refreshes yet"
                note="Once you refresh this plan, the previous week is preserved here instead of being discarded."
              />
            )}
          </div>
        </details>
      </section>

      {/* Substitutions render directly after the collapsed status/summary unit above, per the
          required chronology. */}
      <section id="substitutions" className="atlas-panel atlas-section atlas-stack" style={{ marginTop: "20px" }}>
        <div className="atlas-panel__eyebrow">Substitutions</div>
        <p className="atlas-note">{substitutions.marketNote}</p>
        <div className="atlas-stack">
          {substitutions.substitutions.map((item) => (
            <div key={item.ingredient} className="atlas-list-card">
              <div className="atlas-list-card__title">
                {item.ingredient} {"->"} {item.substitute}
              </div>
              <div className="atlas-list-card__meta">{item.reason}</div>
              <dl className="atlas-detail-list">
                <div className="atlas-detail-list__row">
                  <dt>Budget impact</dt>
                  <dd>{item.budgetImpact}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Swap category</dt>
                  <dd>{item.swapCategory}</dd>
                </div>
              </dl>
              {item.nutrientComparison ? (
                <div className="atlas-list-card__meta">{item.nutrientComparison}</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section id="seven-day-calendar" className="atlas-panel atlas-section atlas-stack" style={{ marginTop: "20px" }}>
        <div className="atlas-panel__eyebrow">Seven-day calendar</div>
        <p className="atlas-note">
          Batch days are outlined; leftover meals show where they carried over from. Filter by how long a
          day&apos;s cook time runs, or scroll for the full week. Meal prep hacks and prep videos now live on
          the <Link href="/cooking">cooking flow</Link>.
        </p>
        <div className="atlas-toolbar">
          <Link href="/cooking" className="atlas-button">
            Go to cooking
          </Link>
        </div>
        <CalendarTimeFilter calendarDays={planner.calendarDays} videoLinks={planner.videoLinks} />
      </section>

      <section id="ingredient-data" className="atlas-panel atlas-section atlas-stack" style={{ marginTop: "20px" }}>
        <div className="atlas-panel__eyebrow">Ingredient data</div>
        <p className="atlas-note">
          Quick lookups against the same product database backing the shopping list. Full cooking
          steps and prep sequencing live on the{" "}
          <Link href="/cooking">cooking flow</Link>.
        </p>
        <div className="atlas-meta">
          <span>{productSearch.primarySource}</span>
          <span>{productSearch.fallbackUsed ? "Backup data (offline copy)" : "Live data"}</span>
          <span>{productSearch.totalResults} matches</span>
        </div>
        <div className="atlas-stack">
          {productSearch.results.slice(0, 3).map((product) => (
            <div key={`${product.source}-${product.sourceId}`} className="atlas-list-card">
              <div className="atlas-list-card__title">
                {product.name}
                {product.brand ? ` (${product.brand})` : ""}
              </div>
              <dl className="atlas-detail-list">
                <div className="atlas-detail-list__row">
                  <dt>Protein</dt>
                  <dd>{product.nutriments.proteinGramsPer100g ?? "n/a"} g / 100 g</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Fiber</dt>
                  <dd>{product.nutriments.fiberGramsPer100g ?? "n/a"} g / 100 g</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Calories</dt>
                  <dd>{product.nutriments.caloriesKcalPer100g ?? "n/a"} kcal / 100 g</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </PageScaffold>
  );
}
