import {
  getNutritionCookingPlanDataWithSource,
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getNutritionSubstitutionsDataWithSource
} from "@/lib/nutrition-data";
import { DataSourceBanner } from "@/components/data-source-banner";
import { PageScaffold } from "@/components/page-scaffold";
import { RecipeSearchForm } from "@/components/recipe-search-form";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";

function getCarryoverNote(lunch: string, dinner: string) {
  if (lunch.toLowerCase().includes("leftover")) {
    return "Lunch is already planned as a leftover handoff from an earlier cook.";
  }

  if (dinner.toLowerCase().includes("batch")) {
    return "Dinner is the main batch-cook anchor for the following meals.";
  }

  if (dinner.toLowerCase().includes("one-pot")) {
    return "Dinner is tuned for low-cleanup execution on a busier night.";
  }

  return "This day stays in the standard quick-cook lane with minimal extra prep.";
}

export default async function CookingPage() {
  const [
    { data: planner, source: plannerSource },
    { data: shoppingList, source: shoppingListSource },
    { data: substitutions, source: substitutionsSource },
    { data: cookingPlan, source: cookingPlanSource }
  ] = await Promise.all([
    getNutritionPlannerDataWithSource(),
    getNutritionShoppingListDataWithSource(),
    getNutritionSubstitutionsDataWithSource(),
    getNutritionCookingPlanDataWithSource()
  ]);
  const source = combineDataSources(plannerSource, shoppingListSource, substitutionsSource, cookingPlanSource);

  const leftoverMeals = planner.meals.filter((meal) => meal.lunch.toLowerCase().includes("leftover")).length;
  const batchAnchors = planner.meals.filter(
    (meal) => meal.dinner.toLowerCase().includes("batch") || meal.dinner.toLowerCase().includes("one-pot")
  ).length;
  const repeatedCategories = Array.from(new Set(shoppingList.items.map((item) => item.category)))
    .map((category) => ({
      category,
      count: shoppingList.items.filter((item) => item.category === category).length
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Cooking flow"
      description="This page converts the current meal plan into an execution sequence: what to prep first, which dinners do the heavy lifting, and where leftovers or substitutions keep the week moving."
      tags={["Cooking", "Prep cadence", "Leftover-aware"]}
      metrics={[
        { label: "Prep lanes", value: `${cookingPlan.steps.length} staged steps` },
        { label: "Leftover handoffs", value: `${leftoverMeals} lunches` },
        { label: "Batch anchors", value: `${batchAnchors} dinners` }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-toolbar">
        <RefreshButton />
      </div>
      <div className="atlas-grid atlas-grid--hero">
        <RecipeSearchForm />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Prep sequence</div>
          <p className="atlas-note">
            {cookingPlan.batchDay} | {cookingPlan.batchWindow} | Today: {cookingPlan.todayFocus}
          </p>
          <div className="atlas-timeline">
            {cookingPlan.steps.map((step, index) => (
              <div key={step.title} className="atlas-timeline__entry">
                <div className="atlas-list-card__title">
                  Step {index + 1}: {step.title}
                </div>
                <div className="atlas-list-card__meta">{step.detail}</div>
                <dl className="atlas-detail-list">
                  <div className="atlas-detail-list__row">
                    <dt>Days</dt>
                    <dd>{step.mealDays.join(", ")}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Effort</dt>
                    <dd>{step.effort}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Equipment</dt>
                    <dd>{step.equipment.join(", ")}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Daily cook cadence</div>
          <p className="atlas-note">{planner.plannerSummary}</p>
          <div className="atlas-stack">
            {planner.meals.map((meal) => (
              <div key={meal.day} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {meal.day}: {meal.dinner} ({meal.cookTimeMinutes} min)
                </div>
                <dl className="atlas-detail-list">
                  <div className="atlas-detail-list__row">
                    <dt>Breakfast</dt>
                    <dd>{meal.breakfast}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Lunch</dt>
                    <dd>{meal.lunch}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Prep</dt>
                    <dd>{meal.prepFocus}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Leftovers</dt>
                    <dd>{meal.leftoverPlan}</dd>
                  </div>
                </dl>
                <div className="atlas-list-card__meta">{getCarryoverNote(meal.lunch, meal.dinner)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Meal prep hacks</div>
          <p className="atlas-note">
            Practical shortcuts attached to this week&apos;s plan to cut active cooking time.
          </p>
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
          <div className="atlas-panel__eyebrow">Ingredient reuse</div>
          <dl className="atlas-detail-list">
            {repeatedCategories.map((entry) => (
              <div key={entry.category} className="atlas-detail-list__row">
                <dt>{entry.category}</dt>
                <dd>{entry.count} items supporting the week</dd>
              </div>
            ))}
          </dl>
          <p className="atlas-note">
            The cooking plan stays efficient by reusing the same category groups across breakfast, lunch, and dinner instead of introducing one-off ingredients.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Leftover handoff</div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Planned leftover lunches</dt>
              <dd>{leftoverMeals}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Core shopping total</dt>
              <dd>{shoppingList.estimatedTotal}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Week in scope</dt>
              <dd>{planner.weekLabel}</dd>
            </div>
          </dl>
          <p className="atlas-note">{cookingPlan.leftoverStrategy}</p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Substitution fallback</div>
          <p className="atlas-note">{substitutions.strategySummary}</p>
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
