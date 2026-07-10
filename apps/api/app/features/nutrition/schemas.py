from pydantic import BaseModel, Field


class NutritionMealSummary(BaseModel):
    day: str
    breakfast: str
    lunch: str
    dinner: str
    prep_focus: str
    cook_time_minutes: int
    leftover_plan: str


class NutritionTargetSummary(BaseModel):
    calories: int
    protein_grams: int
    fiber_grams: int
    hydration_ml: int


class NutritionCostFocusItem(BaseModel):
    label: str
    detail: str


class NutritionMealPrepHack(BaseModel):
    title: str
    detail: str
    applies_to_days: list[str]
    estimated_time_saved_minutes: int
    difficulty: str


class NutritionVideoLink(BaseModel):
    title: str
    url: str
    topic: str
    market_scope: str
    why_recommended: str


class NutritionCalendarMeal(BaseModel):
    slot: str
    title: str
    is_leftover: bool
    carryover_from: str | None = None


class NutritionCalendarDay(BaseModel):
    date: str
    day_label: str
    is_batch_day: bool
    prep_window: str | None = None
    meals: list[NutritionCalendarMeal]
    cook_time_minutes: int
    leftover_into: str | None = None
    status: str


class NutritionPlanRefreshMeta(BaseModel):
    plan_id: str
    planner_version: str
    week_start_date: str
    week_end_date: str
    last_refreshed_at: str
    refresh_due_at: str
    refresh_interval_days: int
    refresh_reason: str
    status: str
    is_stale: bool
    data_freshness: str


class NutritionSwapHistoryEntry(BaseModel):
    refreshed_at: str
    reason: str
    summary: str


class NutritionPlannerResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    week_label: str
    market_code: str
    market_label: str
    currency_code: str
    budget: str
    projected_spend: str
    schedule_label: str
    cooking_cadence: str
    batch_day: str
    days_to_cook: int
    nutrition_targets: NutritionTargetSummary
    cost_focus: list[NutritionCostFocusItem]
    leftover_strategy: str
    meals: list[NutritionMealSummary]
    planner_summary: str
    refresh: NutritionPlanRefreshMeta
    calendar_days: list[NutritionCalendarDay]
    meal_prep_hacks: list[NutritionMealPrepHack]
    video_links: list[NutritionVideoLink]
    swap_history: list[NutritionSwapHistoryEntry] = Field(default_factory=list)


class NutritionShoppingItem(BaseModel):
    name: str
    quantity: str
    estimated_cost: str
    category: str
    priority: str
    used_in_days: list[str]
    already_in_pantry: bool = False


class NutritionShoppingListResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    total_items: int
    estimated_total: str
    categories: list[str]
    batch_cook_item_count: int
    pantry_staple_count: int
    pantry_matched_count: int = 0
    pantry_savings: str = ""
    items: list[NutritionShoppingItem]


class NutritionPantryResponse(BaseModel):
    items: list[str]


class NutritionPantryAddRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class NutritionSubstitutionItem(BaseModel):
    ingredient: str
    substitute: str
    reason: str
    budget_impact: str
    swap_category: str
    nutrient_comparison: str | None = None


class NutritionSubstitutionsResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    market_note: str
    strategy_summary: str
    substitutions: list[NutritionSubstitutionItem]


class NutritionCookingStep(BaseModel):
    title: str
    detail: str
    meal_days: list[str]
    effort: str
    equipment: list[str]


class NutritionCookingPlanResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    batch_day: str
    batch_window: str
    today_focus: str
    leftover_strategy: str
    steps: list[NutritionCookingStep]


class NutritionNutrientFactsResponse(BaseModel):
    calories_kcal_per_100g: float | None = None
    protein_grams_per_100g: float | None = None
    carbohydrates_grams_per_100g: float | None = None
    fat_grams_per_100g: float | None = None
    fiber_grams_per_100g: float | None = None
    sugars_grams_per_100g: float | None = None
    sodium_mg_per_100g: float | None = None


class NutritionProductSummary(BaseModel):
    name: str
    source: str
    source_id: str
    brand: str | None = None
    barcode: str | None = None
    serving_size: str | None = None
    categories: list[str] = Field(default_factory=list)
    image_url: str | None = None
    nutriments: NutritionNutrientFactsResponse
    confidence: float
    external_url: str | None = None


class NutritionProductSearchResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    query: str
    market_code: str
    primary_source: str
    fallback_used: bool
    primary_error: str | None = None
    total_results: int
    results: list[NutritionProductSummary]


class NutritionProductLookupResponse(BaseModel):
    generated_at: str
    active_feature: str = "nutrition"
    barcode: str
    found: bool
    product: NutritionProductSummary | None = None
