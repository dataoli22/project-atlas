import type {
  NutritionCookingPlanData,
  NutritionMealPrepHack,
  NutritionMealSlot,
  NutritionPlanStatus,
  NutritionPlannerData,
  NutritionProductSearchData,
  NutritionShoppingListData,
  NutritionSubstitutionsData,
  NutritionVideoLink
} from "@atlas/shared";

import type { ApiDataSource } from "@/lib/api";
import { fetchJson, requestJson } from "@/lib/api";

const stubPlanner: NutritionPlannerData = {
  generatedAt: "2026-07-09T10:30:00Z",
  activeFeature: "nutrition",
  weekLabel: "Week of July 13, 2026",
  marketCode: "IN",
  marketLabel: "India",
  currencyCode: "INR",
  budget: "INR 1,850",
  projectedSpend: "INR 1,640",
  scheduleLabel: "3 meals daily with 2 leftover lunches",
  cookingCadence: "Cook 4 times across the week",
  batchDay: "Sunday",
  daysToCook: 4,
  nutritionTargets: {
    calories: 2250,
    proteinGrams: 132,
    fiberGrams: 31,
    hydrationMl: 2500
  },
  costFocus: [
    { label: "Protein floor", detail: "Paneer, eggs, and dal keep protein stable without requiring meat at every meal." },
    { label: "Waste control", detail: "Vegetables repeat across lunch and dinner so the produce basket stays compact." },
    { label: "Time saver", detail: "Two dinners are intentionally batch-friendly so lunches need less active cooking." }
  ],
  leftoverStrategy: "Use Sunday and Wednesday dinners as the main leftover anchors for the following lunches.",
  meals: [
    {
      day: "Mon",
      breakfast: "Overnight oats with banana",
      lunch: "Rice, dal, sauteed vegetables",
      dinner: "Chicken and vegetable skillet",
      prepFocus: "Portion breakfast jars and chop onions, tomatoes, and greens.",
      cookTimeMinutes: 30,
      leftoverPlan: "Cook extra chicken for Tuesday lunch."
    },
    {
      day: "Tue",
      breakfast: "Eggs and toast",
      lunch: "Leftover chicken rice bowl",
      dinner: "One-pot vegetable khichdi",
      prepFocus: "Use leftover chicken first to keep weekday cooking short.",
      cookTimeMinutes: 25,
      leftoverPlan: "Khichdi carries into Wednesday lunch if needed."
    },
    {
      day: "Wed",
      breakfast: "Yogurt with fruit and peanuts",
      lunch: "Paneer wrap with salad",
      dinner: "Batch-cooked chickpea curry",
      prepFocus: "Prep chickpeas and spice base in one pass.",
      cookTimeMinutes: 35,
      leftoverPlan: "Chickpea curry covers Thursday lunch."
    },
    {
      day: "Thu",
      breakfast: "Masala oats",
      lunch: "Leftover chickpea curry bowl",
      dinner: "Quick egg bhurji with roti",
      prepFocus: "Hold dinner to a single-pan cook night.",
      cookTimeMinutes: 18,
      leftoverPlan: "No deliberate leftovers; reset the fridge."
    },
    {
      day: "Fri",
      breakfast: "Curd, fruit, and peanuts",
      lunch: "Rice bowl with paneer and vegetables",
      dinner: "Dal khichdi with cucumber salad",
      prepFocus: "Use the remaining cooked rice and produce together.",
      cookTimeMinutes: 24,
      leftoverPlan: "Dal khichdi can stretch into Saturday lunch."
    },
    {
      day: "Sat",
      breakfast: "Vegetable omelette",
      lunch: "Leftover dal khichdi",
      dinner: "Chicken stir-fry with rice",
      prepFocus: "Refresh proteins before the next batch day.",
      cookTimeMinutes: 28,
      leftoverPlan: "Cook one extra portion for Sunday lunch."
    },
    {
      day: "Sun",
      breakfast: "Peanut banana oats",
      lunch: "Leftover chicken stir-fry bowl",
      dinner: "Paneer and vegetable pulao",
      prepFocus: "Run the main weekly prep block before dinner.",
      cookTimeMinutes: 40,
      leftoverPlan: "Sunday dinner becomes the next Monday backup."
    }
  ],
  plannerSummary:
    "The India blueprint leans on dal, rice, oats, eggs, paneer, and vegetables to keep cost low while still covering protein and fiber targets with light weekday cooking.",
  refresh: {
    planId: "plan-IN-2026-07-13",
    plannerVersion: "2026.07",
    weekStartDate: "2026-07-13",
    weekEndDate: "2026-07-19",
    lastRefreshedAt: "2026-07-09T10:30:00Z",
    refreshDueAt: "2026-07-20T00:00:00Z",
    refreshIntervalDays: 7,
    refreshReason: "Scheduled weekly plan",
    status: "current",
    isStale: false,
    dataFreshness: "Deterministic market blueprint, on-device"
  },
  calendarDays: [
    {
      date: "2026-07-13",
      dayLabel: "Mon",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 30,
      leftoverInto: "Tue",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Overnight oats with banana", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Rice, dal, sauteed vegetables", isLeftover: false, carryoverFrom: null },
        { slot: "dinner", title: "Chicken and vegetable skillet", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-14",
      dayLabel: "Tue",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 25,
      leftoverInto: "Wed",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Eggs and toast", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Leftover chicken rice bowl", isLeftover: true, carryoverFrom: "Mon" },
        { slot: "dinner", title: "One-pot vegetable khichdi", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-15",
      dayLabel: "Wed",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 35,
      leftoverInto: "Thu",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Yogurt with fruit and peanuts", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Paneer wrap with salad", isLeftover: false, carryoverFrom: null },
        { slot: "dinner", title: "Batch-cooked chickpea curry", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-16",
      dayLabel: "Thu",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 18,
      leftoverInto: null,
      status: "current",
      meals: [
        { slot: "breakfast", title: "Masala oats", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Leftover chickpea curry bowl", isLeftover: true, carryoverFrom: "Wed" },
        { slot: "dinner", title: "Quick egg bhurji with roti", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-17",
      dayLabel: "Fri",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 24,
      leftoverInto: "Sat",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Curd, fruit, and peanuts", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Rice bowl with paneer and vegetables", isLeftover: false, carryoverFrom: null },
        { slot: "dinner", title: "Dal khichdi with cucumber salad", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-18",
      dayLabel: "Sat",
      isBatchDay: false,
      prepWindow: null,
      cookTimeMinutes: 28,
      leftoverInto: "Sun",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Vegetable omelette", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Leftover dal khichdi", isLeftover: true, carryoverFrom: "Fri" },
        { slot: "dinner", title: "Chicken stir-fry with rice", isLeftover: false, carryoverFrom: null }
      ]
    },
    {
      date: "2026-07-19",
      dayLabel: "Sun",
      isBatchDay: true,
      prepWindow: "90-minute prep block before dinner",
      cookTimeMinutes: 40,
      leftoverInto: "Mon",
      status: "current",
      meals: [
        { slot: "breakfast", title: "Peanut banana oats", isLeftover: false, carryoverFrom: null },
        { slot: "lunch", title: "Leftover chicken stir-fry bowl", isLeftover: true, carryoverFrom: "Sat" },
        { slot: "dinner", title: "Paneer and vegetable pulao", isLeftover: false, carryoverFrom: null }
      ]
    }
  ],
  mealPrepHacks: [
    {
      title: "Batch-cook grains once",
      detail: "Cook the week's rice and base grains in a single session so weekday bowls only need reheating.",
      appliesToDays: ["Mon", "Tue", "Fri", "Sat", "Sun"],
      estimatedTimeSavedMinutes: 45,
      difficulty: "easy"
    },
    {
      title: "Pre-chop repeat vegetables after shopping",
      detail: "Wash and chop the vegetables that repeat across meals right after the shop so mid-week prep is faster.",
      appliesToDays: ["Mon", "Tue", "Wed", "Fri", "Sun"],
      estimatedTimeSavedMinutes: 30,
      difficulty: "easy"
    },
    {
      title: "Stage breakfast jars for 3 days",
      detail: "Portion oats and breakfast jars for the first three mornings to remove decisions.",
      appliesToDays: ["Mon", "Tue", "Wed"],
      estimatedTimeSavedMinutes: 20,
      difficulty: "easy"
    },
    {
      title: "Freeze one fallback meal on batch day",
      detail: "Cook one extra portion on the batch day and freeze it as a no-cook backup night.",
      appliesToDays: ["Sun"],
      estimatedTimeSavedMinutes: 35,
      difficulty: "medium"
    },
    {
      title: "Plan one low-energy leftover night",
      detail: "Keep Thu as a deliberate leftover or single-pan night to protect a busy evening.",
      appliesToDays: ["Thu"],
      estimatedTimeSavedMinutes: 25,
      difficulty: "easy"
    },
    {
      title: "First-pass prep on high-reuse ingredients",
      detail:
        "Prep the ingredients that appear in three or more meals first: Rolled oats, Eggs, Rice, Dal and chickpeas, Paneer, Mixed vegetables, Curd, bananas, peanuts.",
      appliesToDays: ["Sun"],
      estimatedTimeSavedMinutes: 40,
      difficulty: "medium"
    }
  ],
  videoLinks: [
    {
      title: "Beginner weekly meal prep",
      url: "https://www.youtube.com/results?search_query=beginner+weekly+meal+prep",
      topic: "getting-started",
      marketScope: "global",
      whyRecommended: "A simple walkthrough for setting up a first weekly prep routine."
    },
    {
      title: "Budget healthy meal prep",
      url: "https://www.youtube.com/results?search_query=budget+healthy+meal+prep",
      topic: "budget",
      marketScope: "global",
      whyRecommended: "Keeps the plan affordable, matching the low-cost bias of this planner."
    },
    {
      title: "High-protein meal prep",
      url: "https://www.youtube.com/results?search_query=high+protein+meal+prep+for+the+week",
      topic: "protein",
      marketScope: "global",
      whyRecommended: "Supports the 132 g daily protein target."
    },
    {
      title: "Meal prep storage tips",
      url: "https://www.youtube.com/results?search_query=meal+prep+storage+tips",
      topic: "storage",
      marketScope: "global",
      whyRecommended: "Helps leftovers and batch cooking stay safe and fresh across the week."
    },
    {
      title: "Indian budget meal prep",
      url: "https://www.youtube.com/results?search_query=indian+budget+meal+prep",
      topic: "market-specific",
      marketScope: "IN",
      whyRecommended: "Tuned to Indian staples like dal, rice, and paneer used across this plan."
    }
  ],
  swapHistory: []
};

const stubShoppingList: NutritionShoppingListData = {
  generatedAt: "2026-07-09T10:30:00Z",
  activeFeature: "nutrition",
  totalItems: 8,
  estimatedTotal: "INR 1,640",
  categories: ["Breakfast staples", "Grains", "Produce", "Protein"],
  batchCookItemCount: 5,
  pantryStapleCount: 6,
  items: [
    { name: "Rolled oats", quantity: "1 kg", estimatedCost: "INR 180", category: "Breakfast staples", priority: "high", usedInDays: ["Mon", "Thu", "Sun"] },
    { name: "Eggs", quantity: "18", estimatedCost: "INR 144", category: "Protein", priority: "high", usedInDays: ["Tue", "Thu", "Sat"] },
    { name: "Rice", quantity: "2.5 kg", estimatedCost: "INR 180", category: "Grains", priority: "high", usedInDays: ["Mon", "Tue", "Fri", "Sat", "Sun"] },
    { name: "Dal and chickpeas", quantity: "2 kg combined", estimatedCost: "INR 280", category: "Protein", priority: "high", usedInDays: ["Mon", "Wed", "Fri"] },
    { name: "Chicken", quantity: "1.4 kg", estimatedCost: "INR 460", category: "Protein", priority: "medium", usedInDays: ["Mon", "Sat"] },
    { name: "Paneer", quantity: "500 g", estimatedCost: "INR 220", category: "Protein", priority: "medium", usedInDays: ["Wed", "Fri", "Sun"] },
    { name: "Mixed vegetables", quantity: "3 kg", estimatedCost: "INR 330", category: "Produce", priority: "high", usedInDays: ["Mon", "Tue", "Wed", "Fri", "Sun"] },
    { name: "Curd, bananas, peanuts", quantity: "7 breakfast servings", estimatedCost: "INR 166", category: "Breakfast staples", priority: "medium", usedInDays: ["Mon", "Wed", "Fri", "Sun"] }
  ]
};

const stubSubstitutions: NutritionSubstitutionsData = {
  generatedAt: "2026-07-09T10:30:00Z",
  activeFeature: "nutrition",
  marketNote: "This setup is tuned for low-cost Indian staples and short weekday cooking windows.",
  strategySummary: "Favor shared staples first, then swap higher-cost proteins only when the weekly total drifts.",
  substitutions: [
    {
      ingredient: "Chicken breast",
      substitute: "Eggs or dal",
      reason: "Keeps weekday protein flexible at a lower total cost.",
      budgetImpact: "Save INR 167-INR 333",
      swapCategory: "protein"
    },
    {
      ingredient: "Greek yogurt",
      substitute: "Curd",
      reason: "More available locally and easier to reuse across breakfasts.",
      budgetImpact: "Save INR 83-INR 167",
      swapCategory: "breakfast"
    },
    {
      ingredient: "Quinoa",
      substitute: "Rice or millets",
      reason: "Lowers spend without changing the overall planner rhythm.",
      budgetImpact: "Save INR 167-INR 250",
      swapCategory: "grains"
    }
  ]
};

const stubCookingPlan: NutritionCookingPlanData = {
  generatedAt: "2026-07-09T10:30:00Z",
  activeFeature: "nutrition",
  batchDay: "Sunday",
  batchWindow: "90-minute prep block",
  todayFocus: "Portion breakfast jars and chop onions, tomatoes, and greens.",
  leftoverStrategy: "Use Sunday and Wednesday dinners as the main leftover anchors for the following lunches.",
  steps: [
    {
      title: "Prep grains and legumes",
      detail: "Cook the first rice batch and soak or pressure-cook dal/chickpeas together.",
      mealDays: ["Mon", "Tue", "Wed"],
      effort: "medium",
      equipment: ["pot", "pressure cooker"]
    },
    {
      title: "Stage breakfast jars",
      detail: "Set up oats, bananas, peanuts, and curd portions for the first half of the week.",
      mealDays: ["Mon", "Tue", "Wed"],
      effort: "low",
      equipment: ["containers"]
    },
    {
      title: "Anchor two batch dinners",
      detail: "Use the chickpea curry and paneer pulao nights to create the next day's lunch automatically.",
      mealDays: ["Wed", "Sun"],
      effort: "medium",
      equipment: ["pan", "pot"]
    }
  ]
};

const stubProductSearch: NutritionProductSearchData = {
  generatedAt: "2026-07-09T10:30:00Z",
  activeFeature: "nutrition",
  query: "oats",
  marketCode: "IN",
  primarySource: "open_food_facts",
  fallbackUsed: true,
  primaryError: "Backend unavailable from this page.",
  totalResults: 2,
  results: [
    {
      name: "Rolled oats",
      source: "local_fallback",
      sourceId: "atlas-local-oats",
      brand: "Atlas fallback",
      barcode: null,
      servingSize: "40 g",
      categories: ["Breakfast Cereals", "Oats"],
      imageUrl: null,
      nutriments: {
        caloriesKcalPer100g: 389,
        proteinGramsPer100g: 16.9,
        carbohydratesGramsPer100g: 66.3,
        fatGramsPer100g: 6.9,
        fiberGramsPer100g: 10.6,
        sugarsGramsPer100g: 0.9,
        sodiumMgPer100g: 2
      },
      confidence: 0.45,
      externalUrl: "https://world.openfoodfacts.org/cgi/search.pl?search_terms=oats"
    },
    {
      name: "Plain yogurt",
      source: "local_fallback",
      sourceId: "atlas-local-yogurt",
      brand: "Atlas fallback",
      barcode: null,
      servingSize: "100 g",
      categories: ["Dairy", "Yogurts"],
      imageUrl: null,
      nutriments: {
        caloriesKcalPer100g: 61,
        proteinGramsPer100g: 3.5,
        carbohydratesGramsPer100g: 4.7,
        fatGramsPer100g: 3.3,
        fiberGramsPer100g: 0,
        sugarsGramsPer100g: 4.7,
        sodiumMgPer100g: 46
      },
      confidence: 0.45,
      externalUrl: "https://world.openfoodfacts.org/cgi/search.pl?search_terms=yogurt"
    }
  ]
};

type NutritionPlannerApiResponse = {
  generated_at: string;
  active_feature: "nutrition";
  week_label: string;
  market_code: string;
  market_label: string;
  currency_code: string;
  budget: string;
  projected_spend: string;
  schedule_label: string;
  cooking_cadence: string;
  batch_day: string;
  days_to_cook: number;
  nutrition_targets: {
    calories: number;
    protein_grams: number;
    fiber_grams: number;
    hydration_ml: number;
  };
  cost_focus: Array<{
    label: string;
    detail: string;
  }>;
  leftover_strategy: string;
  meals: Array<{
    day: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    prep_focus: string;
    cook_time_minutes: number;
    leftover_plan: string;
  }>;
  planner_summary: string;
  refresh: {
    plan_id: string;
    planner_version: string;
    week_start_date: string;
    week_end_date: string;
    last_refreshed_at: string;
    refresh_due_at: string;
    refresh_interval_days: number;
    refresh_reason: string;
    status: NutritionPlanStatus;
    is_stale: boolean;
    data_freshness: string;
  };
  calendar_days: Array<{
    date: string;
    day_label: string;
    is_batch_day: boolean;
    prep_window: string | null;
    cook_time_minutes: number;
    leftover_into: string | null;
    status: NutritionPlanStatus;
    meals: Array<{
      slot: NutritionMealSlot;
      title: string;
      is_leftover: boolean;
      carryover_from: string | null;
    }>;
  }>;
  meal_prep_hacks: Array<{
    title: string;
    detail: string;
    applies_to_days: string[];
    estimated_time_saved_minutes: number;
    difficulty: NutritionMealPrepHack["difficulty"];
  }>;
  video_links: Array<{
    title: string;
    url: string;
    topic: string;
    market_scope: string;
    why_recommended: string;
  }>;
  swap_history: Array<{
    refreshed_at: string;
    reason: string;
    summary: string;
  }>;
};

type NutritionShoppingListApiResponse = {
  generated_at: string;
  active_feature: "nutrition";
  total_items: number;
  estimated_total: string;
  categories: string[];
  batch_cook_item_count: number;
  pantry_staple_count: number;
  items: Array<{
    name: string;
    quantity: string;
    estimated_cost: string;
    category: string;
    priority: "high" | "medium" | "low";
    used_in_days: string[];
  }>;
};

type NutritionSubstitutionsApiResponse = {
  generated_at: string;
  active_feature: "nutrition";
  market_note: string;
  strategy_summary: string;
  substitutions: Array<{
    ingredient: string;
    substitute: string;
    reason: string;
    budget_impact: string;
    swap_category: string;
  }>;
};

type NutritionCookingPlanApiResponse = {
  generated_at: string;
  active_feature: "nutrition";
  batch_day: string;
  batch_window: string;
  today_focus: string;
  leftover_strategy: string;
  steps: Array<{
    title: string;
    detail: string;
    meal_days: string[];
    effort: string;
    equipment: string[];
  }>;
};

type NutritionProductSearchApiResponse = {
  generated_at: string;
  active_feature: "nutrition";
  query: string;
  market_code: string;
  primary_source: string;
  fallback_used: boolean;
  primary_error: string | null;
  total_results: number;
  results: Array<{
    name: string;
    source: string;
    source_id: string;
    brand: string | null;
    barcode: string | null;
    serving_size: string | null;
    categories: string[];
    image_url: string | null;
    nutriments: {
      calories_kcal_per_100g: number | null;
      protein_grams_per_100g: number | null;
      carbohydrates_grams_per_100g: number | null;
      fat_grams_per_100g: number | null;
      fiber_grams_per_100g: number | null;
      sugars_grams_per_100g: number | null;
      sodium_mg_per_100g: number | null;
    };
    confidence: number;
    external_url: string | null;
  }>;
};

function mapPlannerResponse(response: NutritionPlannerApiResponse): NutritionPlannerData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    weekLabel: response.week_label,
    marketCode: response.market_code,
    marketLabel: response.market_label,
    currencyCode: response.currency_code,
    budget: response.budget,
    projectedSpend: response.projected_spend,
    scheduleLabel: response.schedule_label,
    cookingCadence: response.cooking_cadence,
    batchDay: response.batch_day,
    daysToCook: response.days_to_cook,
    nutritionTargets: {
      calories: response.nutrition_targets.calories,
      proteinGrams: response.nutrition_targets.protein_grams,
      fiberGrams: response.nutrition_targets.fiber_grams,
      hydrationMl: response.nutrition_targets.hydration_ml
    },
    costFocus: response.cost_focus,
    leftoverStrategy: response.leftover_strategy,
    meals: response.meals.map((meal) => ({
      day: meal.day,
      breakfast: meal.breakfast,
      lunch: meal.lunch,
      dinner: meal.dinner,
      prepFocus: meal.prep_focus,
      cookTimeMinutes: meal.cook_time_minutes,
      leftoverPlan: meal.leftover_plan
    })),
    plannerSummary: response.planner_summary,
    refresh: {
      planId: response.refresh.plan_id,
      plannerVersion: response.refresh.planner_version,
      weekStartDate: response.refresh.week_start_date,
      weekEndDate: response.refresh.week_end_date,
      lastRefreshedAt: response.refresh.last_refreshed_at,
      refreshDueAt: response.refresh.refresh_due_at,
      refreshIntervalDays: response.refresh.refresh_interval_days,
      refreshReason: response.refresh.refresh_reason,
      status: response.refresh.status,
      isStale: response.refresh.is_stale,
      dataFreshness: response.refresh.data_freshness
    },
    calendarDays: response.calendar_days.map((day) => ({
      date: day.date,
      dayLabel: day.day_label,
      isBatchDay: day.is_batch_day,
      prepWindow: day.prep_window,
      cookTimeMinutes: day.cook_time_minutes,
      leftoverInto: day.leftover_into,
      status: day.status,
      meals: day.meals.map((meal) => ({
        slot: meal.slot,
        title: meal.title,
        isLeftover: meal.is_leftover,
        carryoverFrom: meal.carryover_from
      }))
    })),
    mealPrepHacks: response.meal_prep_hacks.map((hack) => ({
      title: hack.title,
      detail: hack.detail,
      appliesToDays: hack.applies_to_days,
      estimatedTimeSavedMinutes: hack.estimated_time_saved_minutes,
      difficulty: hack.difficulty
    })),
    videoLinks: response.video_links.map((link) => ({
      title: link.title,
      url: link.url,
      topic: link.topic,
      marketScope: link.market_scope,
      whyRecommended: link.why_recommended
    })),
    swapHistory: response.swap_history.map((entry) => ({
      refreshedAt: entry.refreshed_at,
      reason: entry.reason,
      summary: entry.summary
    }))
  };
}

function plannerFallback(): NutritionPlannerApiResponse {
  return {
    generated_at: stubPlanner.generatedAt,
    active_feature: stubPlanner.activeFeature,
    week_label: stubPlanner.weekLabel,
    market_code: stubPlanner.marketCode,
    market_label: stubPlanner.marketLabel,
    currency_code: stubPlanner.currencyCode,
    budget: stubPlanner.budget,
    projected_spend: stubPlanner.projectedSpend,
    schedule_label: stubPlanner.scheduleLabel,
    cooking_cadence: stubPlanner.cookingCadence,
    batch_day: stubPlanner.batchDay,
    days_to_cook: stubPlanner.daysToCook,
    nutrition_targets: {
      calories: stubPlanner.nutritionTargets.calories,
      protein_grams: stubPlanner.nutritionTargets.proteinGrams,
      fiber_grams: stubPlanner.nutritionTargets.fiberGrams,
      hydration_ml: stubPlanner.nutritionTargets.hydrationMl
    },
    cost_focus: stubPlanner.costFocus,
    leftover_strategy: stubPlanner.leftoverStrategy,
    meals: stubPlanner.meals.map((meal) => ({
      day: meal.day,
      breakfast: meal.breakfast,
      lunch: meal.lunch,
      dinner: meal.dinner,
      prep_focus: meal.prepFocus,
      cook_time_minutes: meal.cookTimeMinutes,
      leftover_plan: meal.leftoverPlan
    })),
    planner_summary: stubPlanner.plannerSummary,
    refresh: {
      plan_id: stubPlanner.refresh.planId,
      planner_version: stubPlanner.refresh.plannerVersion,
      week_start_date: stubPlanner.refresh.weekStartDate,
      week_end_date: stubPlanner.refresh.weekEndDate,
      last_refreshed_at: stubPlanner.refresh.lastRefreshedAt,
      refresh_due_at: stubPlanner.refresh.refreshDueAt,
      refresh_interval_days: stubPlanner.refresh.refreshIntervalDays,
      refresh_reason: stubPlanner.refresh.refreshReason,
      status: stubPlanner.refresh.status,
      is_stale: stubPlanner.refresh.isStale,
      data_freshness: stubPlanner.refresh.dataFreshness
    },
    calendar_days: stubPlanner.calendarDays.map((day) => ({
      date: day.date,
      day_label: day.dayLabel,
      is_batch_day: day.isBatchDay,
      prep_window: day.prepWindow ?? null,
      cook_time_minutes: day.cookTimeMinutes,
      leftover_into: day.leftoverInto ?? null,
      status: day.status,
      meals: day.meals.map((meal) => ({
        slot: meal.slot,
        title: meal.title,
        is_leftover: meal.isLeftover,
        carryover_from: meal.carryoverFrom ?? null
      }))
    })),
    meal_prep_hacks: stubPlanner.mealPrepHacks.map((hack) => ({
      title: hack.title,
      detail: hack.detail,
      applies_to_days: hack.appliesToDays,
      estimated_time_saved_minutes: hack.estimatedTimeSavedMinutes,
      difficulty: hack.difficulty
    })),
    video_links: stubPlanner.videoLinks.map((link) => ({
      title: link.title,
      url: link.url,
      topic: link.topic,
      market_scope: link.marketScope,
      why_recommended: link.whyRecommended
    })),
    swap_history: stubPlanner.swapHistory.map((entry) => ({
      refreshed_at: entry.refreshedAt,
      reason: entry.reason,
      summary: entry.summary
    }))
  };
}

function mapShoppingListResponse(response: NutritionShoppingListApiResponse): NutritionShoppingListData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    totalItems: response.total_items,
    estimatedTotal: response.estimated_total,
    categories: response.categories,
    batchCookItemCount: response.batch_cook_item_count,
    pantryStapleCount: response.pantry_staple_count,
    items: response.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      estimatedCost: item.estimated_cost,
      category: item.category,
      priority: item.priority,
      usedInDays: item.used_in_days
    }))
  };
}

function mapSubstitutionsResponse(response: NutritionSubstitutionsApiResponse): NutritionSubstitutionsData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    marketNote: response.market_note,
    strategySummary: response.strategy_summary,
    substitutions: response.substitutions.map((item) => ({
      ingredient: item.ingredient,
      substitute: item.substitute,
      reason: item.reason,
      budgetImpact: item.budget_impact,
      swapCategory: item.swap_category
    }))
  };
}

function mapCookingPlanResponse(response: NutritionCookingPlanApiResponse): NutritionCookingPlanData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    batchDay: response.batch_day,
    batchWindow: response.batch_window,
    todayFocus: response.today_focus,
    leftoverStrategy: response.leftover_strategy,
    steps: response.steps.map((step) => ({
      title: step.title,
      detail: step.detail,
      mealDays: step.meal_days,
      effort: step.effort,
      equipment: step.equipment
    }))
  };
}

function mapProductSearchResponse(response: NutritionProductSearchApiResponse): NutritionProductSearchData {
  return {
    generatedAt: response.generated_at,
    activeFeature: response.active_feature,
    query: response.query,
    marketCode: response.market_code,
    primarySource: response.primary_source,
    fallbackUsed: response.fallback_used,
    primaryError: response.primary_error,
    totalResults: response.total_results,
    results: response.results.map((product) => ({
      name: product.name,
      source: product.source,
      sourceId: product.source_id,
      brand: product.brand,
      barcode: product.barcode,
      servingSize: product.serving_size,
      categories: product.categories,
      imageUrl: product.image_url,
      nutriments: {
        caloriesKcalPer100g: product.nutriments.calories_kcal_per_100g,
        proteinGramsPer100g: product.nutriments.protein_grams_per_100g,
        carbohydratesGramsPer100g: product.nutriments.carbohydrates_grams_per_100g,
        fatGramsPer100g: product.nutriments.fat_grams_per_100g,
        fiberGramsPer100g: product.nutriments.fiber_grams_per_100g,
        sugarsGramsPer100g: product.nutriments.sugars_grams_per_100g,
        sodiumMgPer100g: product.nutriments.sodium_mg_per_100g
      },
      confidence: product.confidence,
      externalUrl: product.external_url
    }))
  };
}

export async function getNutritionPlannerData(): Promise<NutritionPlannerData> {
  const response = await fetchJson<NutritionPlannerApiResponse>("/api/v1/nutrition/planner", {
    fallback: plannerFallback()
  });

  return mapPlannerResponse(response);
}

/** See lib/endurance-data.ts's getEnduranceDashboardDataWithSource doc comment - same pattern. */
export async function getNutritionPlannerDataWithSource(): Promise<{
  data: NutritionPlannerData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<NutritionPlannerApiResponse>(
    "/api/v1/nutrition/planner",
    { fallback: plannerFallback() }
  );

  return { data: mapPlannerResponse(response), source };
}

export async function refreshNutritionPlan(
  reason?: string
): Promise<{ data: NutritionPlannerData; source: "api" | "stub" }> {
  const trimmed = reason?.trim();
  const result = await requestJson<NutritionPlannerApiResponse>("/api/v1/nutrition/planner/refresh", {
    method: "POST",
    body: trimmed ? { reason: trimmed } : {},
    fallback: {
      ...plannerFallback(),
      refresh: {
        ...plannerFallback().refresh,
        last_refreshed_at: new Date().toISOString(),
        refresh_reason: trimmed || "Manual refresh",
        status: "current",
        is_stale: false
      }
    }
  });

  return { data: mapPlannerResponse(result.data), source: result.source };
}

function shoppingListFallback(): NutritionShoppingListApiResponse {
  return {
    generated_at: stubShoppingList.generatedAt,
    active_feature: stubShoppingList.activeFeature,
    total_items: stubShoppingList.totalItems,
    estimated_total: stubShoppingList.estimatedTotal,
    categories: stubShoppingList.categories,
    batch_cook_item_count: stubShoppingList.batchCookItemCount,
    pantry_staple_count: stubShoppingList.pantryStapleCount,
    items: stubShoppingList.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      estimated_cost: item.estimatedCost,
      category: item.category,
      priority: item.priority,
      used_in_days: item.usedInDays
    }))
  };
}

export async function getNutritionShoppingListData(): Promise<NutritionShoppingListData> {
  const response = await fetchJson<NutritionShoppingListApiResponse>("/api/v1/nutrition/shopping-list", {
    fallback: shoppingListFallback()
  });

  return mapShoppingListResponse(response);
}

/** See lib/endurance-data.ts's getEnduranceDashboardDataWithSource doc comment - same pattern. */
export async function getNutritionShoppingListDataWithSource(): Promise<{
  data: NutritionShoppingListData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<NutritionShoppingListApiResponse>(
    "/api/v1/nutrition/shopping-list",
    { fallback: shoppingListFallback() }
  );

  return { data: mapShoppingListResponse(response), source };
}

function substitutionsFallback(): NutritionSubstitutionsApiResponse {
  return {
    generated_at: stubSubstitutions.generatedAt,
    active_feature: stubSubstitutions.activeFeature,
    market_note: stubSubstitutions.marketNote,
    strategy_summary: stubSubstitutions.strategySummary,
    substitutions: stubSubstitutions.substitutions.map((item) => ({
      ingredient: item.ingredient,
      substitute: item.substitute,
      reason: item.reason,
      budget_impact: item.budgetImpact,
      swap_category: item.swapCategory
    }))
  };
}

export async function getNutritionSubstitutionsData(): Promise<NutritionSubstitutionsData> {
  const response = await fetchJson<NutritionSubstitutionsApiResponse>("/api/v1/nutrition/substitutions", {
    fallback: substitutionsFallback()
  });

  return mapSubstitutionsResponse(response);
}

/** See lib/endurance-data.ts's getEnduranceDashboardDataWithSource doc comment - same pattern. */
export async function getNutritionSubstitutionsDataWithSource(): Promise<{
  data: NutritionSubstitutionsData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<NutritionSubstitutionsApiResponse>(
    "/api/v1/nutrition/substitutions",
    { fallback: substitutionsFallback() }
  );

  return { data: mapSubstitutionsResponse(response), source };
}

function cookingPlanFallback(): NutritionCookingPlanApiResponse {
  return {
    generated_at: stubCookingPlan.generatedAt,
    active_feature: stubCookingPlan.activeFeature,
    batch_day: stubCookingPlan.batchDay,
    batch_window: stubCookingPlan.batchWindow,
    today_focus: stubCookingPlan.todayFocus,
    leftover_strategy: stubCookingPlan.leftoverStrategy,
    steps: stubCookingPlan.steps.map((step) => ({
      title: step.title,
      detail: step.detail,
      meal_days: step.mealDays,
      effort: step.effort,
      equipment: step.equipment
    }))
  };
}

export async function getNutritionCookingPlanData(): Promise<NutritionCookingPlanData> {
  const response = await fetchJson<NutritionCookingPlanApiResponse>("/api/v1/nutrition/cooking-plan", {
    fallback: cookingPlanFallback()
  });

  return mapCookingPlanResponse(response);
}

/** See lib/endurance-data.ts's getEnduranceDashboardDataWithSource doc comment - same pattern. */
export async function getNutritionCookingPlanDataWithSource(): Promise<{
  data: NutritionCookingPlanData;
  source: ApiDataSource;
}> {
  const { data: response, source } = await requestJson<NutritionCookingPlanApiResponse>(
    "/api/v1/nutrition/cooking-plan",
    { fallback: cookingPlanFallback() }
  );

  return { data: mapCookingPlanResponse(response), source };
}

export async function searchNutritionProducts(query = "oats", limit = 4): Promise<NutritionProductSearchData> {
  const params = new URLSearchParams({
    query,
    limit: String(limit)
  });
  const response = await fetchJson<NutritionProductSearchApiResponse>(
    `/api/v1/nutrition/products/search?${params.toString()}`,
    {
      fallback: {
        generated_at: stubProductSearch.generatedAt,
        active_feature: stubProductSearch.activeFeature,
        query: stubProductSearch.query,
        market_code: stubProductSearch.marketCode,
        primary_source: stubProductSearch.primarySource,
        fallback_used: stubProductSearch.fallbackUsed,
        primary_error: stubProductSearch.primaryError ?? null,
        total_results: stubProductSearch.totalResults,
        results: stubProductSearch.results.map((product) => ({
          name: product.name,
          source: product.source,
          source_id: product.sourceId,
          brand: product.brand ?? null,
          barcode: product.barcode ?? null,
          serving_size: product.servingSize ?? null,
          categories: product.categories,
          image_url: product.imageUrl ?? null,
          nutriments: {
            calories_kcal_per_100g: product.nutriments.caloriesKcalPer100g ?? null,
            protein_grams_per_100g: product.nutriments.proteinGramsPer100g ?? null,
            carbohydrates_grams_per_100g: product.nutriments.carbohydratesGramsPer100g ?? null,
            fat_grams_per_100g: product.nutriments.fatGramsPer100g ?? null,
            fiber_grams_per_100g: product.nutriments.fiberGramsPer100g ?? null,
            sugars_grams_per_100g: product.nutriments.sugarsGramsPer100g ?? null,
            sodium_mg_per_100g: product.nutriments.sodiumMgPer100g ?? null
          },
          confidence: product.confidence,
          external_url: product.externalUrl ?? null
        }))
      }
    }
  );

  return mapProductSearchResponse(response);
}
