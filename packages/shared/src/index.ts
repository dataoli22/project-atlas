export type AtlasFeature = "endurance" | "nutrition";

export type PlatformDensity = "comfortable" | "compact";

export interface AppPreference {
  activeFeature: AtlasFeature;
  enabledFeatureFlags: AtlasFeature[];
  preferredPlatformDensity: PlatformDensity;
  sharedLocale: string;
  hasCompletedOnboarding: boolean;
}

export interface SharedHealthProfile {
  hydrationMl?: number;
  weightKg?: number;
  activityLevel?: string;
}

export interface FeatureDefinition {
  key: AtlasFeature;
  label: string;
  description: string;
}

export interface EnduranceDashboardCard {
  label: string;
  value: string;
  trend?: string;
}

export interface EnduranceWorkoutSummary {
  title: string;
  duration: string;
  distance: string;
  recoveryNote: string;
}

export interface EnduranceDashboardData {
  generatedAt: string;
  activeFeature: "endurance";
  cards: EnduranceDashboardCard[];
  latestWorkout: EnduranceWorkoutSummary;
  coachSummary: string;
  /** Coach support resources (recovery, strength, base training, connector setup). Non-medical. */
  supportLinks: EnduranceSupportLink[];
}

export interface EnduranceTimelineEntry {
  dayLabel: string;
  sessionLabel: string;
  duration: string;
  load: string;
  source: string;
}

export interface EnduranceCapabilityArea {
  label: string;
  score: number;
  direction: string;
}

export interface EnduranceCapabilitySnapshot {
  headline: string;
  areas: EnduranceCapabilityArea[];
  confidence: "high" | "medium" | "low";
  confidenceNote: string;
}

export interface EnduranceInsightItem {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export type EnduranceSupportResourceType =
  | "recovery"
  | "mobility"
  | "strength"
  | "base-training"
  | "connector-setup"
  | "general";

/**
 * A curated, non-medical support resource surfaced by the endurance coach
 * (recovery/mobility routines, strength for runners, base training, connector setup help).
 * These are deliberately separated from coaching advice and must never imply medical guidance.
 */
export interface EnduranceSupportLink {
  title: string;
  url: string;
  topic: string;
  whyRecommended: string;
  resourceType: EnduranceSupportResourceType;
  /** ISO-8601 timestamp describing when this recommendation was generated. */
  freshnessAt?: string | null;
}

export interface EnduranceTimelineData {
  generatedAt: string;
  activeFeature: "endurance";
  entries: EnduranceTimelineEntry[];
}

/**
 * A conservative red-flag notice derived only from synced numbers (never symptoms or history),
 * always non-diagnostic and framed as "worth mentioning to a doctor." See
 * apps/api/app/features/endurance/medical_escalation.py for the detection thresholds and the
 * approved copy this is sourced from.
 */
export interface EnduranceMedicalFlag {
  flagType: string;
  severity: "high" | "medium";
  message: string;
  detail: string;
}

export interface EnduranceInsightsData {
  generatedAt: string;
  activeFeature: "endurance";
  capability: EnduranceCapabilitySnapshot;
  insights: EnduranceInsightItem[];
  /** Support resources are non-medical and always tagged with why they are relevant. */
  supportLinks: EnduranceSupportLink[];
  medicalFlags: EnduranceMedicalFlag[];
}

export interface NutritionMealSummary {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  prepFocus: string;
  cookTimeMinutes: number;
  leftoverPlan: string;
}

export interface NutritionTargetSummary {
  calories: number;
  proteinGrams: number;
  fiberGrams: number;
  hydrationMl: number;
}

export interface NutritionCostFocusItem {
  label: string;
  detail: string;
}

export type NutritionPlanStatus = "current" | "refreshing" | "stale" | "failed";

export type NutritionMealSlot = "breakfast" | "lunch" | "dinner";

/**
 * Practical execution helper attached to a weekly plan (batch-cook grains,
 * pre-chop repeat vegetables, stage breakfast jars, freeze a fallback meal, etc.).
 */
export interface NutritionMealPrepHack {
  title: string;
  detail: string;
  /** Day labels (e.g. ["Mon", "Wed"]) this hack applies to. */
  appliesToDays: string[];
  estimatedTimeSavedMinutes: number;
  difficulty: "easy" | "medium" | "advanced";
}

/** Curated YouTube (or other) resource for meal prep execution. */
export interface NutritionVideoLink {
  title: string;
  url: string;
  topic: string;
  /** Market this resource is most relevant to, or "global". */
  marketScope: string;
  whyRecommended: string;
}

export interface NutritionCalendarMeal {
  slot: NutritionMealSlot;
  title: string;
  isLeftover: boolean;
  /** Day label the leftover was carried over from, when applicable. */
  carryoverFrom?: string | null;
}

/** One day within the seven-day calendar surface. */
export interface NutritionCalendarDay {
  /** ISO-8601 date, e.g. "2026-07-13". */
  date: string;
  dayLabel: string;
  isBatchDay: boolean;
  /** Human-readable prep window shown on the calendar, when this is a prep anchor. */
  prepWindow?: string | null;
  meals: NutritionCalendarMeal[];
  cookTimeMinutes: number;
  /** Day label this day's cooking carries leftovers into, when applicable. */
  leftoverInto?: string | null;
  status: NutritionPlanStatus;
}

/** Refresh + provenance metadata driving the seven-day refresh cycle. */
export interface NutritionPlanRefreshMeta {
  planId: string;
  plannerVersion: string;
  /** ISO-8601 date of the first calendar day. */
  weekStartDate: string;
  /** ISO-8601 date of the last (seventh) calendar day. */
  weekEndDate: string;
  /** ISO-8601 timestamp of the last generation/refresh. */
  lastRefreshedAt: string;
  /** ISO-8601 timestamp when the plan should auto-refresh (weekStart + intervalDays). */
  refreshDueAt: string;
  refreshIntervalDays: number;
  refreshReason: string;
  status: NutritionPlanStatus;
  /** Whether refreshDueAt is in the past relative to the server's clock. */
  isStale: boolean;
  dataFreshness: string;
}

/** A record of a previous plan generation, preserved instead of silent overwrite. */
export interface NutritionSwapHistoryEntry {
  refreshedAt: string;
  reason: string;
  summary: string;
}

export type NutritionCuisine = "indian" | "japanese" | "chinese" | "continental";

export interface NutritionPlannerData {
  generatedAt: string;
  activeFeature: "nutrition";
  weekLabel: string;
  marketCode: string;
  marketLabel: string;
  currencyCode: string;
  cuisine: NutritionCuisine;
  budget: string;
  projectedSpend: string;
  scheduleLabel: string;
  cookingCadence: string;
  batchDay: string;
  daysToCook: number;
  nutritionTargets: NutritionTargetSummary;
  costFocus: NutritionCostFocusItem[];
  leftoverStrategy: string;
  meals: NutritionMealSummary[];
  plannerSummary: string;
  /** Refresh + provenance metadata for the seven-day cycle. */
  refresh: NutritionPlanRefreshMeta;
  /** Exactly seven days for the calendar surface. */
  calendarDays: NutritionCalendarDay[];
  mealPrepHacks: NutritionMealPrepHack[];
  videoLinks: NutritionVideoLink[];
  /** Prior generations, newest first. */
  swapHistory: NutritionSwapHistoryEntry[];
}

export interface NutritionShoppingItem {
  name: string;
  quantity: string;
  estimatedCost: string;
  category: string;
  priority: "high" | "medium" | "low";
  usedInDays: string[];
  alreadyInPantry: boolean;
}

export interface NutritionShoppingListData {
  generatedAt: string;
  activeFeature: "nutrition";
  totalItems: number;
  estimatedTotal: string;
  categories: string[];
  batchCookItemCount: number;
  pantryStapleCount: number;
  pantryMatchedCount: number;
  pantrySavings: string;
  items: NutritionShoppingItem[];
}

export interface NutritionSubstitutionItem {
  ingredient: string;
  substitute: string;
  reason: string;
  budgetImpact: string;
  swapCategory: string;
  nutrientComparison: string | null;
}

export interface NutritionSubstitutionsData {
  generatedAt: string;
  activeFeature: "nutrition";
  marketNote: string;
  strategySummary: string;
  substitutions: NutritionSubstitutionItem[];
}

export interface NutritionCookingStep {
  title: string;
  detail: string;
  mealDays: string[];
  effort: string;
  equipment: string[];
}

export interface NutritionCookingPlanData {
  generatedAt: string;
  activeFeature: "nutrition";
  batchDay: string;
  batchWindow: string;
  todayFocus: string;
  leftoverStrategy: string;
  steps: NutritionCookingStep[];
}

export interface NutritionNutrientFactsData {
  caloriesKcalPer100g?: number | null;
  proteinGramsPer100g?: number | null;
  carbohydratesGramsPer100g?: number | null;
  fatGramsPer100g?: number | null;
  fiberGramsPer100g?: number | null;
  sugarsGramsPer100g?: number | null;
  sodiumMgPer100g?: number | null;
}

export interface NutritionProductSummaryData {
  name: string;
  source: string;
  sourceId: string;
  brand?: string | null;
  barcode?: string | null;
  servingSize?: string | null;
  categories: string[];
  imageUrl?: string | null;
  nutriments: NutritionNutrientFactsData;
  confidence: number;
  externalUrl?: string | null;
}

export interface NutritionProductSearchData {
  generatedAt: string;
  activeFeature: "nutrition";
  query: string;
  marketCode: string;
  primarySource: string;
  fallbackUsed: boolean;
  primaryError?: string | null;
  totalResults: number;
  results: NutritionProductSummaryData[];
}

// Nutrition listed first: it's the higher-usage module day to day, so it leads the feature
// switcher, nav groups, and default landing feature (see apps/web/lib/navigation.ts and
// apps/web/lib/shell-preferences.ts, plus the backend default in apps/api/app/core/config.py).
export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "nutrition",
    label: "Nutrition and Meal Planning",
    description: "Budget-aware nutrition, meal planning, shopping, and cooking."
  },
  {
    key: "endurance",
    label: "Endurance and Capability",
    description: "Training, recovery, capability, and adaptation tracking."
  }
];
