import { DataSourceBanner } from "@/components/data-source-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";
import {
  getNutritionCookingPlanDataWithSource,
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getNutritionSubstitutionsDataWithSource,
  searchNutritionProducts
} from "@/lib/nutrition-data";
import { formatCurrencyDisplay } from "@/lib/localization";
import { getLocalizationSettingsData } from "@/lib/settings-data";

export default async function NutritionPage() {
  const [
    { data: planner, source: plannerSource },
    { data: shoppingList, source: shoppingListSource },
    { data: substitutions, source: substitutionsSource },
    { data: cookingPlan, source: cookingPlanSource },
    productSearch,
    localization
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionShoppingListDataWithSource(),
    getNutritionSubstitutionsDataWithSource(),
    getNutritionCookingPlanDataWithSource(),
    searchNutritionProducts("oats", 4),
    getLocalizationSettingsData()
  ]);
  const source = combineDataSources(plannerSource, shoppingListSource, substitutionsSource, cookingPlanSource);

  const budget = formatCurrencyDisplay(planner.budget, localization.data);
  const projectedSpend = formatCurrencyDisplay(planner.projectedSpend, localization.data);
  const estimatedTotal = formatCurrencyDisplay(shoppingList.estimatedTotal, localization.data);
  const topMeals = planner.meals.slice(0, 3);

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Nutrition and cooking snapshot"
      description="This summary now reads from the same weekly nutrition contract as planner, shopping, and cooking. It keeps budget, targets, prep cadence, and swap logic in one place so the feature behaves like a real module instead of a placeholder."
      tags={["Nutrition summary", "Cooking cadence", "Budget-aware"]}
      metrics={[
        { label: "Calories", value: `${planner.nutritionTargets.calories}` },
        { label: "Protein", value: `${planner.nutritionTargets.proteinGrams} g` },
        { label: "Fiber", value: `${planner.nutritionTargets.fiberGrams} g` }
      ]}
    >
      <DataSourceBanner source={source} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <RefreshButton />
      </div>
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Weekly frame</div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Market</dt>
              <dd>{planner.marketLabel}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Currency</dt>
              <dd>{planner.currencyCode}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Schedule</dt>
              <dd>{planner.scheduleLabel}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Cooking cadence</dt>
              <dd>{planner.cookingCadence}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Batch day</dt>
              <dd>{planner.batchDay}</dd>
            </div>
          </dl>
          <p className="atlas-note">{planner.plannerSummary}</p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Budget and shopping</div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Weekly budget</dt>
              <dd>{budget}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Projected spend</dt>
              <dd>{projectedSpend}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Shopping total</dt>
              <dd>{estimatedTotal}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Categories</dt>
              <dd>{shoppingList.categories.join(" | ")}</dd>
            </div>
          </dl>
          <p className="atlas-note">
            {shoppingList.batchCookItemCount} high-priority items drive the batch-cook lane, while {shoppingList.pantryStapleCount} staples do most of the workload.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Nutrition targets</div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Calories</dt>
              <dd>{planner.nutritionTargets.calories}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Protein</dt>
              <dd>{planner.nutritionTargets.proteinGrams} g</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Fiber</dt>
              <dd>{planner.nutritionTargets.fiberGrams} g</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Hydration</dt>
              <dd>{planner.nutritionTargets.hydrationMl} ml</dd>
            </div>
          </dl>
          <div className="atlas-stack">
            {planner.costFocus.map((item) => (
              <div key={item.label} className="atlas-list-card">
                <div className="atlas-list-card__title">{item.label}</div>
                <div className="atlas-list-card__meta">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Cooking handoff</div>
          <p className="atlas-note">{cookingPlan.leftoverStrategy}</p>
          <div className="atlas-stack">
            {cookingPlan.steps.map((step, index) => (
              <div key={step.title} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  Step {index + 1}: {step.title}
                </div>
                <div className="atlas-list-card__meta">
                  {step.detail} | Days: {step.mealDays.join(", ")} | Effort: {step.effort}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">First three days</div>
          <div className="atlas-stack">
            {topMeals.map((meal) => (
              <div key={meal.day} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {meal.day} | {meal.cookTimeMinutes} min dinner
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
          <div className="atlas-panel__eyebrow">Substitution logic</div>
          <p className="atlas-note">{substitutions.strategySummary}</p>
          <div className="atlas-stack">
            {substitutions.substitutions.map((item) => (
              <div key={item.ingredient} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {item.ingredient} {"->"} {item.substitute}
                </div>
                <div className="atlas-list-card__meta">
                  {item.reason} | {item.budgetImpact}
                </div>
                {item.nutrientComparison ? (
                  <div className="atlas-list-card__meta">{item.nutrientComparison}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Ingredient data</div>
          <div className="atlas-meta">
            <span>{productSearch.primarySource}</span>
            <span>{productSearch.fallbackUsed ? "Fallback active" : "Live data"}</span>
            <span>{productSearch.totalResults} matches</span>
          </div>
          {productSearch.primaryError ? (
            <p className="atlas-note">{productSearch.primaryError}</p>
          ) : null}
          <div className="atlas-stack">
            {productSearch.results.slice(0, 3).map((product) => (
              <div key={`${product.source}-${product.sourceId}`} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {product.name}
                  {product.brand ? ` | ${product.brand}` : ""}
                </div>
                <div className="atlas-list-card__meta">
                  {product.source} | Confidence {Math.round(product.confidence * 100)}%
                  {product.servingSize ? ` | Serving ${product.servingSize}` : ""}
                </div>
                <div className="atlas-list-card__meta">
                  Protein {product.nutriments.proteinGramsPer100g ?? "n/a"} g | Fiber {product.nutriments.fiberGramsPer100g ?? "n/a"} g | Calories {product.nutriments.caloriesKcalPer100g ?? "n/a"} kcal / 100 g
                </div>
                {product.externalUrl ? (
                  <div className="atlas-list-card__meta">
                    <a href={product.externalUrl} target="_blank" rel="noreferrer">
                      Open source record
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageScaffold>
  );
}
