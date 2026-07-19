import Link from "next/link";

import {
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getPantryItems
} from "@/lib/nutrition-data";
import { DataSourceBanner } from "@/components/data-source-banner";
import { HintTooltip } from "@/components/hint-tooltip";
import { PageScaffold } from "@/components/page-scaffold";
import { PantryManagerForm } from "@/components/pantry-manager-form";
import { RefreshButton } from "@/components/refresh-button";
import { ShoppingListExportButton } from "@/components/shopping-list-export-button";
import { combineDataSources } from "@/lib/data-source";
import { formatCurrencyDisplay, formatLocalizedCurrency, parseLocalizedAmount } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

export default async function ShoppingPage() {
  const [
    { data: planner, source: plannerSource },
    { data: shoppingList, source: shoppingListSource },
    localization,
    pantry
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionShoppingListDataWithSource(),
    getLocalizationSettingsData(),
    getPantryItems()
  ]);
  const source = combineDataSources(plannerSource, shoppingListSource);

  const budgetAmount = parseLocalizedAmount(planner.budget);
  const projectedAmount = parseLocalizedAmount(planner.projectedSpend);
  const estimatedAmount = parseLocalizedAmount(shoppingList.estimatedTotal);
  const plannerBudget = formatCurrencyDisplay(planner.budget, localization.data);
  const projectedSpend = formatCurrencyDisplay(planner.projectedSpend, localization.data);
  const estimatedTotal = formatCurrencyDisplay(shoppingList.estimatedTotal, localization.data);

  const remainingBudget =
    budgetAmount !== null && projectedAmount !== null
      ? formatLocalizedCurrency(budgetAmount - projectedAmount, localization.data)
      : "N/A";
  const budgetVarianceAmount =
    projectedAmount !== null && estimatedAmount !== null ? estimatedAmount - projectedAmount : null;
  const budgetVarianceSummary =
    budgetVarianceAmount === null
      ? "close to"
      : budgetVarianceAmount === 0
        ? "on target with"
        : `${formatLocalizedCurrency(Math.abs(budgetVarianceAmount), localization.data)} ${
            budgetVarianceAmount > 0 ? "above" : "below"
          }`;

  // Days actually planned (a day counts as "planned" once any meal slot is filled in) and how
  // many items in the current list are swap-driven ("As needed" / "Not estimated" placeholders
  // come from swapped meals per the nutrition service contract) - a short dynamic summary instead
  // of the old full day-by-day breakdown, which now lives only on the Planner.
  const plannedDayCount = planner.meals.filter(
    (meal) => meal.breakfast || meal.lunch || meal.dinner
  ).length;
  const totalDayCount = planner.meals.length;
  const swappedItemCount = shoppingList.items.filter(
    (item) => item.quantity === "As needed" || item.estimatedCost === "Not estimated"
  ).length;

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Pantry"
      description="A quick store-run pass: budget context, what still needs buying (including anything swapped in this week), a way to log what's already on hand, and an export you can take with you."
      tags={["Pantry", "Shopping", "Budget-aware"]}
      metrics={[
        { label: "Week", value: planner.weekLabel },
        { label: "Estimated total", value: estimatedTotal },
        { label: "Still needed", value: `${shoppingList.totalItems} items` }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <ShoppingListExportButton
          items={shoppingList.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            estimatedCost: item.estimatedCost
          }))}
        />
        <div className="atlas-toolbar">
          <Link href="/planner" className="atlas-button">
            Back to planner
          </Link>
          <Link href="/cooking" className="atlas-button">
            Go to cooking flow
          </Link>
          <RefreshButton />
        </div>
      </div>

      <nav className="atlas-section-nav" aria-label="Jump to section">
        <a className="atlas-section-nav__link" href="#budget-snapshot">Budget</a>
        <a className="atlas-section-nav__link" href="#what-to-buy">What to buy</a>
        <a className="atlas-section-nav__link" href="#pantry-manager">Your pantry</a>
      </nav>

      <section id="budget-snapshot" className="atlas-panel atlas-section atlas-stack">
        <div
          className="atlas-panel__eyebrow"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          Budget snapshot
          <HintTooltip label="These four numbers">
            Planner budget: what you set as your target. Projected spend: what the meal plan was
            expected to cost when generated. Shopping estimate: the current list&apos;s cost, including
            any swaps since. Budget remaining: planner budget minus projected spend.
          </HintTooltip>
        </div>
        <div className="atlas-stat-grid">
          <div className="atlas-stat">
            <div className="atlas-stat__label">Planner budget</div>
            <div className="atlas-stat__value">{plannerBudget}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Projected spend</div>
            <div className="atlas-stat__value">{projectedSpend}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Shopping estimate</div>
            <div className="atlas-stat__value">{estimatedTotal}</div>
          </div>
          <div className="atlas-stat">
            <div className="atlas-stat__label">Budget remaining</div>
            <div className="atlas-stat__value">{remainingBudget}</div>
          </div>
        </div>
        <p className="atlas-note">
          The current list sits {budgetVarianceSummary} the planner projection
          {" "}&middot;{" "}
          {plannedDayCount} of {totalDayCount} days planned this week
          {swappedItemCount > 0 ? `, ${swappedItemCount} swap${swappedItemCount === 1 ? "" : "s"} made` : ""}.
        </p>
        {/* Real, honest progress toward this week's actual meal plan - not an invented score.
            Counts the same "days planned" figure already shown in the note above, just made
            visible as a bar so a full week reads as a clear, at-a-glance finish line. */}
        <div className="atlas-progress">
          <div className="atlas-progress__label">
            <span>Week planned</span>
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
            {plannedDayCount >= totalDayCount ? "Full week planned" : "Week in progress"}
          </span>
          {shoppingList.pantryMatchedCount > 0 ? (
            <span className="atlas-badge atlas-badge--earned">
              <span className="atlas-badge__dot" />
              {shoppingList.pantryMatchedCount} items already have a home in your pantry
            </span>
          ) : null}
        </div>
      </section>

      <section id="what-to-buy" className="atlas-panel atlas-section atlas-stack" style={{ marginTop: "16px" }}>
        <div className="atlas-panel__eyebrow">What to buy</div>
        <div className="atlas-meta">
          <span>{shoppingList.totalItems} line items</span>
          <span>{shoppingList.categories.length} categories</span>
          {shoppingList.pantryMatchedCount > 0 ? (
            <span>
              {shoppingList.pantryMatchedCount} already in pantry (saved {shoppingList.pantrySavings})
            </span>
          ) : null}
          {swappedItemCount > 0 ? <span>{swappedItemCount} from meal swaps</span> : null}
        </div>
        <div
          className={shoppingList.items.length > 8 ? "atlas-scroll-list atlas-scroll-list--fade" : undefined}
          {...(shoppingList.items.length > 8
            ? { tabIndex: 0, role: "region", "aria-label": "Shopping list items" }
            : {})}
        >
          <dl className="atlas-detail-list">
            {shoppingList.items.map((item) => (
              <div key={`${item.name}-${item.quantity}`} className="atlas-detail-list__row">
                <dt>
                  {item.name}
                  {item.alreadyInPantry ? " (have it)" : ""}
                </dt>
                <dd>
                  {item.quantity} &middot; {item.estimatedCost} &middot; {item.category} &middot; {item.priority}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {shoppingList.items.length > 8 ? (
          <div className="atlas-scroll-hint">Scroll for the full list</div>
        ) : null}
      </section>

      <div id="pantry-manager" style={{ marginTop: "16px", scrollMarginTop: "64px" }}>
        <PantryManagerForm initialItems={pantry.data} />
      </div>
    </PageScaffold>
  );
}
