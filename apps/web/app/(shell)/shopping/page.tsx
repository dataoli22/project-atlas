import {
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getNutritionSubstitutionsDataWithSource,
  getPantryItems
} from "@/lib/nutrition-data";
import { DataSourceBanner } from "@/components/data-source-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { PantryManagerForm } from "@/components/pantry-manager-form";
import { combineDataSources } from "@/lib/data-source";
import {
  formatCurrencyDisplay,
  formatLocalizedCurrency,
  parseLocalizedAmount
} from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

function getItemFrequencyByCategory(categories: Array<{ category: string; itemCount: number }>) {
  if (categories.length === 0) {
    return "No categories";
  }

  return categories
    .map((group) => `${group.category} (${group.itemCount})`)
    .join(" | ");
}

export default async function ShoppingPage() {
  const [
    { data: planner, source: plannerSource },
    { data: shoppingList, source: shoppingListSource },
    { data: substitutions, source: substitutionsSource },
    localization,
    pantry
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionShoppingListDataWithSource(),
    getNutritionSubstitutionsDataWithSource(),
    getLocalizationSettingsData(),
    getPantryItems()
  ]);
  const source = combineDataSources(plannerSource, shoppingListSource, substitutionsSource);

  const groupedItems = shoppingList.items.reduce<Record<string, typeof shoppingList.items>>((groups, item) => {
    groups[item.category] ??= [];
    groups[item.category].push(item);

    return groups;
  }, {});

  const categorySummaries = Object.entries(groupedItems)
    .map(([category, items]) => ({
      category,
      items,
      itemCount: items.length
    }))
    .sort((left, right) => right.itemCount - left.itemCount || left.category.localeCompare(right.category));

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
    projectedAmount !== null && estimatedAmount !== null
      ? estimatedAmount - projectedAmount
      : null;
  const budgetVariance =
    budgetVarianceAmount === null
      ? "N/A"
      : budgetVarianceAmount === 0
        ? "on target with"
        : `${formatLocalizedCurrency(Math.abs(budgetVarianceAmount), localization.data)} ${
            budgetVarianceAmount > 0 ? "above" : "below"
          }`;
  const budgetVarianceSummary =
    budgetVariance === "N/A" ? "close to" : budgetVariance === "on target with" ? budgetVariance : `${budgetVariance}`;

  const pantryLeanCategories = categorySummaries.slice(0, 2).map((group) => group.category);
  const coveredDays = planner.meals.length;
  const substitutionHighlights = substitutions.substitutions.slice(0, 2);

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Shopping flow"
      description="This view turns the current nutrition plan into a mobile-friendly store run: grouped pickups, budget context, and swap guidance stay visible together so the shopping pass sets up the cooking week."
      tags={["Shopping", "Grouped list", "Budget-aware"]}
      metrics={[
        { label: "Week", value: planner.weekLabel },
        { label: "Estimated total", value: estimatedTotal },
        { label: "Days covered", value: `${coveredDays} planned days` }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Budget snapshot</div>
          <div className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Planner budget</dt>
              <dd>{plannerBudget}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Projected spend</dt>
              <dd>{projectedSpend}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Shopping estimate</dt>
              <dd>{estimatedTotal}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Budget remaining</dt>
              <dd>{remainingBudget}</dd>
            </div>
          </div>
          <p className="atlas-note">
            The current list sits {budgetVarianceSummary} the planner projection and keeps the plan centered on repeat-use staples.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Store route</div>
          <div className="atlas-meta">
            <span>{shoppingList.totalItems} line items still needed</span>
            <span>{categorySummaries.length} categories</span>
            {shoppingList.pantryMatchedCount > 0 ? (
              <span>
                {shoppingList.pantryMatchedCount} already in pantry (saved {shoppingList.pantrySavings})
              </span>
            ) : null}
          </div>
          <div className="atlas-stack">
            {categorySummaries.map((group) => (
              <div key={group.category} className="atlas-list-card">
                <div className="atlas-list-card__title">{group.category}</div>
                <div className="atlas-list-card__meta">
                  {group.items
                    .map(
                      (item) =>
                        `${item.name} (${item.quantity}, ${item.priority})${
                          item.alreadyInPantry ? " - already have this" : ""
                        }`
                    )
                    .join(" | ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <PantryManagerForm initialItems={pantry.data} />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Meal coverage</div>
          <p className="atlas-note">{planner.plannerSummary}</p>
          <div className="atlas-stack">
            {planner.meals.map((meal) => (
              <div key={meal.day} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {meal.day} meals
                </div>
                <div className="atlas-list-card__meta">
                  Breakfast: {meal.breakfast} | Lunch: {meal.lunch} | Dinner: {meal.dinner}
                </div>
                <div className="atlas-list-card__meta">
                  Prep: {meal.prepFocus} | Leftovers: {meal.leftoverPlan}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Buy once, use often</div>
          <div className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Top categories</dt>
              <dd>{getItemFrequencyByCategory(categorySummaries)}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Pantry lean</dt>
              <dd>{pantryLeanCategories.join(" + ")}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Cooking handoff</dt>
              <dd>{coveredDays} days staged</dd>
            </div>
          </div>
          <p className="atlas-note">
            Grouping by category keeps the mobile checklist quick to scan while the repeated staples help the week stay low-friction after the store run.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Swap guidance</div>
          <p className="atlas-note">{substitutions.marketNote}</p>
          <div className="atlas-stack">
            {substitutionHighlights.map((item) => (
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
