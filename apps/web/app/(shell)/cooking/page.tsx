import Link from "next/link";

import {
  getNutritionCookingPlanDataWithSource,
  getNutritionPlannerDataWithSource,
  getNutritionShoppingListDataWithSource,
  getNutritionSubstitutionsDataWithSource
} from "@/lib/nutrition-data";
import { DataSourceBanner } from "@/components/data-source-banner";
import { FollowRecipeButton } from "@/components/follow-recipe-button";
import { HintTooltip } from "@/components/hint-tooltip";
import { PageScaffold } from "@/components/page-scaffold";
import { RecipeSearchForm } from "@/components/recipe-search-form";
import { RefreshButton } from "@/components/refresh-button";
import { combineDataSources } from "@/lib/data-source";
import { matchVideoForMeal } from "@/lib/match-video";
import type { NutritionVideoLink } from "@atlas/shared";

function MealSlotCell({
  slot,
  title,
  videoLinks
}: {
  slot: string;
  title: string;
  videoLinks: NutritionVideoLink[];
}) {
  const video = matchVideoForMeal(title, videoLinks);
  return (
    <div style={{ flex: "1 1 0", minWidth: "140px" }}>
      <div className="atlas-list-card__meta" style={{ textTransform: "capitalize" }}>
        {slot}
      </div>
      <div className="atlas-list-card__title" style={{ fontSize: "0.95rem" }}>
        {title}
      </div>
      {video ? (
        <a href={video.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem" }}>
          Watch video
        </a>
      ) : null}
      {/* Video links are best-effort topic matches and often have no match at all. The
          "Follow recipe" action calls the real, rate-limited recipe-search endpoint on demand
          (not on page load) so every meal can still get a real, actually-followable recipe
          link even when no video matched. */}
      <FollowRecipeButton dishName={title} />
    </div>
  );
}

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
      tags={["Cooking", "Prep rhythm", "Leftover-aware"]}
      metrics={[
        { label: "Prep lanes", value: `${cookingPlan.steps.length} staged steps` },
        { label: "Leftover handoffs", value: `${leftoverMeals} lunches` },
        { label: "Batch anchors", value: `${batchAnchors} dinners` }
      ]}
    >
      <DataSourceBanner source={source} />
      <div className="atlas-toolbar" style={{ justifyContent: "space-between" }}>
        <div className="atlas-toolbar">
          <Link href="/planner" className="atlas-button">
            Back to planner
          </Link>
          <Link href="/shopping" className="atlas-button">
            Go to pantry
          </Link>
        </div>
        <RefreshButton />
      </div>
      {/* Sticky jump-nav so a long, section-heavy page can be navigated without scrolling past
          everything before the section a user wants. */}
      <nav className="atlas-section-nav" aria-label="Jump to section">
        <a className="atlas-section-nav__link" href="#recipe-search">Recipe search</a>
        <a className="atlas-section-nav__link" href="#prep-sequence">Prep sequence</a>
        <a className="atlas-section-nav__link" href="#cook-cadence">Daily rhythm</a>
        <a className="atlas-section-nav__link" href="#prep-hacks">Prep hacks</a>
        <a className="atlas-section-nav__link" href="#prep-videos">Videos</a>
        <a className="atlas-section-nav__link" href="#ingredient-reuse">Ingredient reuse</a>
        <a className="atlas-section-nav__link" href="#leftover-handoff">Leftovers</a>
        <a className="atlas-section-nav__link" href="#substitutions">Substitutions</a>
      </nav>
      {/* Full-width, vertically stacked sections rather than a narrow two-column grid - each
          section gets the full page width so its content (search results, step lists, day
          rows) reads comfortably instead of being squeezed into a half-width column. Sections use
          the tighter atlas-section spacing (instead of the roomier default atlas-panel padding)
          plus a colored top rule and two-line header so each chunk reads as visually distinct
          rather than one continuous scroll of same-weight panels. */}
      <div className="atlas-stack" style={{ gap: "12px" }}>
        <div id="recipe-search" style={{ scrollMarginTop: "64px" }}>
          <RecipeSearchForm />
        </div>

        <section id="prep-sequence" className="atlas-panel atlas-section atlas-stack">
          <div className="atlas-section__header">
            <div>
              <div
                className="atlas-panel__eyebrow"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                Prep sequence
                <HintTooltip label="What batch-cook order means">
                  The order to prep things in so one cooking session covers multiple meals later
                  in the week, instead of cooking from scratch every day.
                </HintTooltip>
              </div>
              <h2 className="atlas-section__title">This week&apos;s batch-cook order</h2>
            </div>
            <span className="atlas-section__count">{cookingPlan.steps.length} steps</span>
          </div>
          <p className="atlas-note">Batch day: {cookingPlan.batchDay}</p>
          <p className="atlas-note">Window: {cookingPlan.batchWindow}</p>
          <p className="atlas-note">Today: {cookingPlan.todayFocus}</p>
          <div className="atlas-timeline">
            {cookingPlan.steps.map((step, index) => (
              <div key={step.title} className="atlas-timeline__entry atlas-timeline__entry--numbered">
                <span className="atlas-timeline__badge">{index + 1}</span>
                <div className="atlas-list-card__title">{step.title}</div>
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

        <section id="cook-cadence" className="atlas-panel atlas-section atlas-stack">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">Daily cooking rhythm</div>
              <h2 className="atlas-section__title">Meal-by-meal week view</h2>
            </div>
            <span className="atlas-section__count">{planner.meals.length} days</span>
          </div>
          <p className="atlas-note">{planner.plannerSummary}</p>
          {/* Each day collapses to its title/time by default - a full week of expanded
              breakfast/lunch/dinner + prep + leftover detail was the single biggest contributor
              to page length, and most users only need to open the day they're planning for. */}
          <div className="atlas-stack" style={{ gap: "6px" }}>
            {planner.meals.map((meal, index) => (
              <details key={meal.day} className="atlas-accordion" open={index === 0}>
                <summary className="atlas-accordion__summary">
                  <span>{meal.day}</span>
                  <span className="atlas-section__count">{meal.cookTimeMinutes} min</span>
                </summary>
                <div className="atlas-accordion__body">
                  {/* Breakfast/lunch/dinner side-by-side instead of three stacked dt/dd rows - the
                      week reads left-to-right as a day's meal sequence, not a tall vertical list. */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    <MealSlotCell slot="breakfast" title={meal.breakfast} videoLinks={planner.videoLinks} />
                    <MealSlotCell slot="lunch" title={meal.lunch} videoLinks={planner.videoLinks} />
                    <MealSlotCell slot="dinner" title={meal.dinner} videoLinks={planner.videoLinks} />
                  </div>
                  <dl className="atlas-detail-list">
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
              </details>
            ))}
          </div>
        </section>

        <section id="prep-hacks" className="atlas-panel atlas-section atlas-stack atlas-section--warm">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">Meal prep hacks</div>
              <h2 className="atlas-section__title">Shortcuts to cut active cooking time</h2>
            </div>
            <span className="atlas-section__count">{planner.mealPrepHacks.length} hacks</span>
          </div>
          <div className="atlas-stack">
            {planner.mealPrepHacks.map((hack) => (
              <div key={hack.title} className="atlas-list-card">
                <div className="atlas-list-card__title">{hack.title}</div>
                <div className="atlas-list-card__meta">{hack.detail}</div>
                <dl className="atlas-detail-list">
                  <div className="atlas-detail-list__row">
                    <dt>Days</dt>
                    <dd>{hack.appliesToDays.join(", ") || "Any"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Saves</dt>
                    <dd>~{hack.estimatedTimeSavedMinutes} min ({hack.difficulty})</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section id="prep-videos" className="atlas-panel atlas-section atlas-stack atlas-section--warm">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">Prep videos</div>
              <h2 className="atlas-section__title">Curated watch list</h2>
            </div>
            <span className="atlas-section__count">{planner.videoLinks.length} videos</span>
          </div>
          <p className="atlas-note">Curated searches to help execute the week. Opens on YouTube.</p>
          <details className="atlas-accordion">
            <summary className="atlas-accordion__summary">
              <span>Show all videos</span>
              <span className="atlas-section__count">{planner.videoLinks.length}</span>
            </summary>
            <div className="atlas-accordion__body">
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
                  <div className="atlas-list-card__meta">{video.topic}</div>
                  <div className="atlas-list-card__meta">Region: {video.marketScope}</div>
                  <div className="atlas-list-card__meta">{video.whyRecommended}</div>
                </a>
              ))}
            </div>
          </details>
        </section>

        <section id="ingredient-reuse" className="atlas-panel atlas-section atlas-stack">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">Ingredient reuse</div>
              <h2 className="atlas-section__title">Shared categories across the week</h2>
            </div>
          </div>
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

        <section id="leftover-handoff" className="atlas-panel atlas-section atlas-stack">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">Leftover handoff</div>
              <h2 className="atlas-section__title">Where the week&apos;s cooking pays off</h2>
            </div>
          </div>
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

        <section id="substitutions" className="atlas-panel atlas-section atlas-stack">
          <div className="atlas-section__header">
            <div>
              <div className="atlas-panel__eyebrow">If you can&apos;t find an ingredient</div>
              <h2 className="atlas-section__title">Swaps if an ingredient falls through</h2>
            </div>
            <span className="atlas-section__count">{substitutions.substitutions.length} swaps</span>
          </div>
          <p className="atlas-note">{substitutions.strategySummary}</p>
          <details className="atlas-accordion">
            <summary className="atlas-accordion__summary">
              <span>Show all substitutions</span>
              <span className="atlas-section__count">{substitutions.substitutions.length}</span>
            </summary>
            <div className="atlas-accordion__body">
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
          </details>
        </section>
      </div>
    </PageScaffold>
  );
}
