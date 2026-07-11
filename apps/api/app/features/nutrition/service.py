from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from app.core.config import build_market_registry
from app.features.nutrition.data_sources import (
    NutritionDataSourceError,
    NutritionProduct,
    OpenFoodFactsDataSource,
)
from app.features.nutrition.schemas import (
    NutritionCalendarDay,
    NutritionCalendarMeal,
    NutritionCookingPlanResponse,
    NutritionCookingStep,
    NutritionCostFocusItem,
    NutritionMealPrepHack,
    NutritionMealSummary,
    NutritionPlanRefreshMeta,
    NutritionPlannerResponse,
    NutritionShoppingItem,
    NutritionShoppingListResponse,
    NutritionSubstitutionItem,
    NutritionSubstitutionsResponse,
    NutritionSwapHistoryEntry,
    NutritionTargetSummary,
    NutritionVideoLink,
)
from app.features.shared.services.state import shared_state

_GENERATED_AT = "2026-07-09T10:30:00Z"
_WEEK_START_DATE = date(2026, 7, 13)
_PLANNER_VERSION = "2026.07"
_REFRESH_INTERVAL_DAYS = 7
_DATA_FRESHNESS = "Deterministic market blueprint, on-device"
_BATCH_PREP_WINDOW = "90-minute prep block before dinner"

_ABBREV_TO_FULL = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday",
}

_MARKET_VIDEO = {
    "IN": (
        "Indian budget meal prep",
        "https://www.youtube.com/results?search_query=indian+budget+meal+prep",
        "Tuned to Indian staples like dal, rice, and paneer used across this plan.",
    ),
    "US": (
        "US budget meal prep",
        "https://www.youtube.com/results?search_query=budget+meal+prep+usa",
        "Matches the freezer-friendly, low-cost US basket in this plan.",
    ),
    "UK": (
        "UK budget meal prep",
        "https://www.youtube.com/results?search_query=uk+budget+meal+prep",
        "Aligned with UK supermarket staples and repeat-lunch structure.",
    ),
    "EU": (
        "European budget meal prep",
        "https://www.youtube.com/results?search_query=european+budget+meal+prep",
        "Flexible across European cuisines while keeping one low-cost structure.",
    ),
    "CN": (
        "Chinese home cooking meal prep",
        "https://www.youtube.com/results?search_query=chinese+home+cooking+meal+prep",
        "Rice- and tofu-led batch cooking that mirrors this plan's rhythm.",
    ),
    "JP": (
        "Japanese home cooking meal prep",
        "https://www.youtube.com/results?search_query=japanese+home+cooking+meal+prep",
        "Rice, miso, and simple grilled or simmered proteins that mirror this plan's rhythm.",
    ),
}


@dataclass(frozen=True)
class WeeklyMealTemplate:
    day: str
    breakfast: str
    lunch: str
    dinner: str
    prep_focus: str
    cook_time_minutes: int
    leftover_plan: str


@dataclass(frozen=True)
class MarketNutritionBlueprint:
    market_code: str
    market_label: str
    # One cuisine identity per market blueprint - matches the real dish composition of that
    # market's meals below (Indian/Japanese/Chinese staples, or a Western "continental" mix for
    # EU/UK/US). Exposed on NutritionPlannerResponse so the frontend can show/filter by cuisine.
    cuisine: str
    week_label: str
    schedule_label: str
    cooking_cadence: str
    batch_day: str
    days_to_cook: int
    budget_amount: float
    projected_spend_amount: float
    target_summary: NutritionTargetSummary
    planner_summary: str
    leftover_strategy: str
    market_note: str
    strategy_summary: str
    cost_focus: list[NutritionCostFocusItem]
    meals: list[WeeklyMealTemplate]
    shopping_items: list[dict[str, object]]
    substitutions: list[dict[str, str]]
    cooking_steps: list[dict[str, object]]


_FX_RATES_TO_USD = {
    "USD": 1.0,
    "EUR": 1.09,
    "GBP": 1.28,
    "INR": 0.012,
    "CNY": 0.14,
    "JPY": 0.0067,
}


def get_nutrition_planner() -> NutritionPlannerResponse:
    blueprint, currency_code = _resolve_blueprint()
    runtime = shared_state.get_nutrition_runtime()
    refresh = _build_refresh_meta(blueprint, runtime)
    return NutritionPlannerResponse(
        generated_at=_GENERATED_AT,
        week_label=blueprint.week_label,
        market_code=blueprint.market_code,
        market_label=blueprint.market_label,
        currency_code=currency_code,
        cuisine=blueprint.cuisine,
        budget=_format_money(blueprint.budget_amount, currency_code),
        projected_spend=_format_money(blueprint.projected_spend_amount, currency_code),
        schedule_label=blueprint.schedule_label,
        cooking_cadence=blueprint.cooking_cadence,
        batch_day=blueprint.batch_day,
        days_to_cook=blueprint.days_to_cook,
        nutrition_targets=blueprint.target_summary,
        cost_focus=blueprint.cost_focus,
        leftover_strategy=blueprint.leftover_strategy,
        meals=[
            NutritionMealSummary(
                day=meal.day,
                breakfast=meal.breakfast,
                lunch=meal.lunch,
                dinner=meal.dinner,
                prep_focus=meal.prep_focus,
                cook_time_minutes=meal.cook_time_minutes,
                leftover_plan=meal.leftover_plan,
            )
            for meal in blueprint.meals
        ],
        planner_summary=blueprint.planner_summary,
        refresh=refresh,
        calendar_days=_build_calendar_days(blueprint, refresh.status),
        meal_prep_hacks=_build_meal_prep_hacks(blueprint),
        video_links=_build_video_links(blueprint),
        swap_history=[
            NutritionSwapHistoryEntry(
                refreshed_at=str(entry.get("refreshed_at", "")),
                reason=str(entry.get("reason", "")),
                summary=str(entry.get("summary", "")),
            )
            for entry in runtime["swap_history"]
        ],
    )


def refresh_nutrition_planner(reason: str | None = None) -> NutritionPlannerResponse:
    """Record the outgoing plan in swap history and advance the refresh cycle."""
    blueprint, _currency_code = _resolve_blueprint()
    runtime = shared_state.get_nutrition_runtime()
    outgoing = _build_refresh_meta(blueprint, runtime)
    resolved_reason = (reason or "").strip() or "Manual refresh"

    now = datetime.now(timezone.utc)
    now_iso = _iso_z(now)
    next_due_iso = _iso_z(now + timedelta(days=_REFRESH_INTERVAL_DAYS))

    outgoing_entry = {
        "refreshed_at": outgoing.last_refreshed_at,
        "reason": outgoing.refresh_reason,
        "summary": (
            f"{blueprint.week_label} plan for {blueprint.market_label} archived "
            f"(was {outgoing.status})."
        ),
    }
    shared_state.record_nutrition_refresh(
        outgoing_entry=outgoing_entry,
        last_refreshed_at=now_iso,
        refresh_due_at=next_due_iso,
        refresh_reason=resolved_reason,
    )
    return get_nutrition_planner()


def _build_refresh_meta(
    blueprint: MarketNutritionBlueprint, runtime: dict[str, object]
) -> NutritionPlanRefreshMeta:
    week_start = _WEEK_START_DATE
    week_end = week_start + timedelta(days=6)
    default_due = _iso_z(_utc_midnight(week_start) + timedelta(days=_REFRESH_INTERVAL_DAYS))

    last_refreshed_at = str(runtime.get("last_refreshed_at") or _GENERATED_AT)
    refresh_due_at = str(runtime.get("refresh_due_at") or default_due)
    refresh_reason = str(runtime.get("refresh_reason") or "Scheduled weekly plan")

    is_stale = _parse_iso(refresh_due_at) < datetime.now(timezone.utc)
    status = "stale" if is_stale else "current"

    return NutritionPlanRefreshMeta(
        plan_id=f"plan-{blueprint.market_code}-{week_start.isoformat()}",
        planner_version=_PLANNER_VERSION,
        week_start_date=week_start.isoformat(),
        week_end_date=week_end.isoformat(),
        last_refreshed_at=last_refreshed_at,
        refresh_due_at=refresh_due_at,
        refresh_interval_days=_REFRESH_INTERVAL_DAYS,
        refresh_reason=refresh_reason,
        status=status,
        is_stale=is_stale,
        data_freshness=_DATA_FRESHNESS,
    )


def _build_calendar_days(
    blueprint: MarketNutritionBlueprint, status: str
) -> list[NutritionCalendarDay]:
    days: list[NutritionCalendarDay] = []
    meals = blueprint.meals
    total = len(meals)
    for index, meal in enumerate(meals):
        day_date = (_WEEK_START_DATE + timedelta(days=index)).isoformat()
        is_batch = _is_batch_day(meal.day, blueprint.batch_day)
        previous_label = meals[index - 1].day if index > 0 else meals[-1].day
        next_label = meals[index + 1].day if index + 1 < total else meals[0].day

        calendar_meals = [
            _calendar_meal("breakfast", meal.breakfast, previous_label),
            _calendar_meal("lunch", meal.lunch, previous_label),
            _calendar_meal("dinner", meal.dinner, previous_label),
        ]
        days.append(
            NutritionCalendarDay(
                date=day_date,
                day_label=meal.day,
                is_batch_day=is_batch,
                prep_window=_BATCH_PREP_WINDOW if is_batch else None,
                meals=calendar_meals,
                cook_time_minutes=meal.cook_time_minutes,
                leftover_into=_leftover_into(meal.leftover_plan, next_label),
                status=status,
            )
        )
    return days


def _calendar_meal(slot: str, title: str, previous_label: str) -> NutritionCalendarMeal:
    is_leftover = "leftover" in title.lower()
    return NutritionCalendarMeal(
        slot=slot,
        title=title,
        is_leftover=is_leftover,
        carryover_from=previous_label if is_leftover else None,
    )


def _build_meal_prep_hacks(blueprint: MarketNutritionBlueprint) -> list[NutritionMealPrepHack]:
    first_three = [meal.day for meal in blueprint.meals[:3]]
    grain_days = _days_for_category(blueprint, "Grains") or first_three
    produce_days = _days_for_category(blueprint, "Produce") or first_three
    batch_label = _batch_day_label(blueprint)
    low_energy_day = min(blueprint.meals, key=lambda meal: meal.cook_time_minutes).day
    high_reuse = [
        str(item["name"])
        for item in blueprint.shopping_items
        if len([day for day in item["used_in_days"] if day != "All week"]) >= 3
    ]
    high_reuse_detail = (
        "Prep the ingredients that appear in three or more meals first: "
        + ", ".join(high_reuse)
        + "."
        if high_reuse
        else "Prep the most-reused staples first so later cooking is faster."
    )

    return [
        NutritionMealPrepHack(
            title="Batch-cook grains once",
            detail=(
                "Cook the week's rice and base grains in a single session so weekday bowls "
                "only need reheating."
            ),
            applies_to_days=grain_days,
            estimated_time_saved_minutes=45,
            difficulty="easy",
        ),
        NutritionMealPrepHack(
            title="Pre-chop repeat vegetables after shopping",
            detail=(
                "Wash and chop the vegetables that repeat across meals right after the shop so "
                "mid-week prep is faster."
            ),
            applies_to_days=produce_days,
            estimated_time_saved_minutes=30,
            difficulty="easy",
        ),
        NutritionMealPrepHack(
            title="Stage breakfast jars for 3 days",
            detail="Portion oats and breakfast jars for the first three mornings to remove decisions.",
            applies_to_days=first_three,
            estimated_time_saved_minutes=20,
            difficulty="easy",
        ),
        NutritionMealPrepHack(
            title="Freeze one fallback meal on batch day",
            detail="Cook one extra portion on the batch day and freeze it as a no-cook backup night.",
            applies_to_days=[batch_label],
            estimated_time_saved_minutes=35,
            difficulty="medium",
        ),
        NutritionMealPrepHack(
            title="Plan one low-energy leftover night",
            detail=(
                f"Keep {low_energy_day} as a deliberate leftover or single-pan night to protect "
                "a busy evening."
            ),
            applies_to_days=[low_energy_day],
            estimated_time_saved_minutes=25,
            difficulty="easy",
        ),
        NutritionMealPrepHack(
            title="First-pass prep on high-reuse ingredients",
            detail=high_reuse_detail,
            applies_to_days=[batch_label],
            estimated_time_saved_minutes=40,
            difficulty="medium",
        ),
    ]


def _build_video_links(blueprint: MarketNutritionBlueprint) -> list[NutritionVideoLink]:
    links = [
        NutritionVideoLink(
            title="Beginner weekly meal prep",
            url="https://www.youtube.com/results?search_query=beginner+weekly+meal+prep",
            topic="getting-started",
            market_scope="global",
            why_recommended="A simple walkthrough for setting up a first weekly prep routine.",
        ),
        NutritionVideoLink(
            title="Budget healthy meal prep",
            url="https://www.youtube.com/results?search_query=budget+healthy+meal+prep",
            topic="budget",
            market_scope="global",
            why_recommended="Keeps the plan affordable, matching the low-cost bias of this planner.",
        ),
        NutritionVideoLink(
            title="High-protein meal prep",
            url="https://www.youtube.com/results?search_query=high+protein+meal+prep+for+the+week",
            topic="protein",
            market_scope="global",
            why_recommended=(
                f"Supports the {blueprint.target_summary.protein_grams} g daily protein target."
            ),
        ),
        NutritionVideoLink(
            title="Meal prep storage tips",
            url="https://www.youtube.com/results?search_query=meal+prep+storage+tips",
            topic="storage",
            market_scope="global",
            why_recommended="Helps leftovers and batch cooking stay safe and fresh across the week.",
        ),
    ]
    market_entry = _MARKET_VIDEO.get(blueprint.market_code)
    if market_entry:
        title, url, why = market_entry
        links.append(
            NutritionVideoLink(
                title=title,
                url=url,
                topic="market-specific",
                market_scope=blueprint.market_code,
                why_recommended=why,
            )
        )
    return links


def _days_for_category(blueprint: MarketNutritionBlueprint, category: str) -> list[str]:
    days: list[str] = []
    for item in blueprint.shopping_items:
        if str(item["category"]) != category:
            continue
        for day in item["used_in_days"]:
            day_label = str(day)
            if day_label != "All week" and day_label not in days:
                days.append(day_label)
    return days


def _batch_day_label(blueprint: MarketNutritionBlueprint) -> str:
    for meal in blueprint.meals:
        if _is_batch_day(meal.day, blueprint.batch_day):
            return meal.day
    return blueprint.batch_day


def _is_batch_day(day_label: str, batch_day: str) -> bool:
    return day_label[:3].lower() == batch_day[:3].lower()


def _leftover_into(leftover_plan: str, next_label: str) -> str | None:
    text = leftover_plan.lower()
    next_full = _ABBREV_TO_FULL.get(next_label, next_label)
    if next_full.lower() in text or next_label.lower() in text:
        return next_label
    return None


def _utc_midnight(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc)


def _iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def get_nutrition_shopping_list() -> NutritionShoppingListResponse:
    blueprint, currency_code = _resolve_blueprint()
    pantry_items = shared_state.get_pantry_items()
    items = [
        NutritionShoppingItem(
            name=str(item["name"]),
            quantity=str(item["quantity"]),
            estimated_cost=_format_money(float(item["estimated_cost_amount"]), currency_code),
            category=str(item["category"]),
            priority=str(item["priority"]),
            used_in_days=list(item["used_in_days"]),
            already_in_pantry=_matches_pantry(str(item["name"]), pantry_items),
        )
        for item in blueprint.shopping_items
    ]
    categories = sorted({item.category for item in items})
    batch_cook_count = sum(1 for item in items if item.priority == "high")
    pantry_staple_count = sum(1 for item in items if item.category in {"Breakfast staples", "Grains", "Protein"})

    # "Still need to buy" totals - matched items stay visible in the list (flagged, not hidden)
    # so the user can see what was skipped and why, but the totals that matter for an actual
    # shopping trip only count what they don't already have.
    still_needed = [item for item in blueprint.shopping_items if not _matches_pantry(str(item["name"]), pantry_items)]
    matched = [item for item in blueprint.shopping_items if _matches_pantry(str(item["name"]), pantry_items)]
    total_amount = sum(float(item["estimated_cost_amount"]) for item in still_needed)
    pantry_savings_amount = sum(float(item["estimated_cost_amount"]) for item in matched)

    return NutritionShoppingListResponse(
        generated_at="2026-07-09T10:30:00Z",
        total_items=len(still_needed),
        estimated_total=_format_money(total_amount, currency_code),
        categories=categories,
        batch_cook_item_count=batch_cook_count,
        pantry_staple_count=pantry_staple_count,
        pantry_matched_count=len(matched),
        pantry_savings=_format_money(pantry_savings_amount, currency_code),
        items=items,
    )


def _matches_pantry(item_name: str, pantry_items: list[str]) -> bool:
    """A shopping item is considered already-owned if its name and a pantry entry share a
    case-insensitive substring match in either direction - "onion" in the pantry should match a
    shopping item named "Yellow onions", not just an exact "onion" == "onion" comparison, since
    real pantry entries and blueprint ingredient names are rarely worded identically.
    """
    normalized_item = item_name.strip().lower()
    for pantry_entry in pantry_items:
        normalized_pantry = pantry_entry.strip().lower()
        if not normalized_pantry:
            continue
        if normalized_pantry in normalized_item or normalized_item in normalized_pantry:
            return True
    return False


def get_nutrition_substitutions() -> NutritionSubstitutionsResponse:
    blueprint, currency_code = _resolve_blueprint()
    return NutritionSubstitutionsResponse(
        generated_at="2026-07-09T10:30:00Z",
        market_note=blueprint.market_note,
        strategy_summary=blueprint.strategy_summary,
        substitutions=[
            NutritionSubstitutionItem(
                ingredient=item["ingredient"],
                substitute=item["substitute"],
                reason=item["reason"],
                budget_impact=_budget_impact_in_currency(item["budget_impact_usd"], currency_code),
                swap_category=item["swap_category"],
                nutrient_comparison=_real_nutrient_comparison(
                    ingredient=item["ingredient"], substitute=item["substitute"]
                ),
            )
            for item in blueprint.substitutions
        ],
    )


_food_product_cache: dict[str, NutritionProduct] = {}
_FOOD_PRODUCT_CACHE_MAX_SIZE = 64


def _lookup_food_product(name: str) -> NutritionProduct | None:
    """Process-lifetime cache of a single food item's real nutrition facts, backing
    _real_nutrient_comparison. Cached because the substitution list is looked up on every
    /substitutions request, and OpenFoodFacts data for "chicken breast" doesn't change between
    requests - re-hitting the network every time would only add latency for no benefit.

    Deliberately only caches successes, not None - a plain @lru_cache would also cache a
    transient failure (a 503, a momentary network blip) forever for the life of the process,
    permanently hiding a comparison that would have worked on retry a minute later. Misses are
    cheap to retry; a wrongly-cached "unavailable" is not self-healing.
    """
    if name in _food_product_cache:
        return _food_product_cache[name]

    # Blueprint substitute text is written for humans, not a product search box - "Eggs or dal"
    # is a real, useful substitution note but not a real product name, so it structurally
    # matches nothing. Fall back to the first alternative ("Eggs") rather than giving up,
    # without ever inventing a name that wasn't actually in the original text.
    candidates = [name]
    for separator in (" or ", "/", ","):
        if separator in name:
            candidates.append(name.split(separator, 1)[0].strip())
            break

    for candidate in candidates:
        try:
            results = OpenFoodFactsDataSource().search_products(candidate, market_code="", limit=1)
        except NutritionDataSourceError:
            continue
        if results:
            if len(_food_product_cache) >= _FOOD_PRODUCT_CACHE_MAX_SIZE:
                _food_product_cache.pop(next(iter(_food_product_cache)))
            _food_product_cache[name] = results[0]
            return results[0]

    return None


def _real_nutrient_comparison(*, ingredient: str, substitute: str) -> str | None:
    """Grounds the substitution's "why" in real nutrition data instead of only the blueprint's
    static prose reason - looks up both sides via OpenFoodFacts (already the app's primary
    nutrition data source, see data_sources.py) and reports actual calories/protein per 100g.
    Returns None (not a fabricated placeholder) if either side can't be found or the lookup
    fails - OpenFoodFacts doesn't have every ingredient, and a missing comparison should read as
    "unavailable," not as invented numbers.
    """
    ingredient_product = _lookup_food_product(ingredient)
    substitute_product = _lookup_food_product(substitute)
    if ingredient_product is None or substitute_product is None:
        return None

    ingredient_summary = _nutrient_summary(ingredient_product)
    substitute_summary = _nutrient_summary(substitute_product)
    if ingredient_summary is None or substitute_summary is None:
        return None

    return f"{ingredient}: {ingredient_summary} per 100g -> {substitute}: {substitute_summary} per 100g (OpenFoodFacts)"


def _nutrient_summary(product: NutritionProduct) -> str | None:
    calories = product.nutriments.calories_kcal_per_100g
    protein = product.nutriments.protein_grams_per_100g
    if calories is None and protein is None:
        return None
    parts = []
    if calories is not None:
        parts.append(f"{calories:.0f}kcal")
    if protein is not None:
        parts.append(f"{protein:.0f}g protein")
    return " / ".join(parts)


def get_nutrition_cooking_plan() -> NutritionCookingPlanResponse:
    blueprint, _currency_code = _resolve_blueprint()
    return NutritionCookingPlanResponse(
        generated_at="2026-07-09T10:30:00Z",
        batch_day=blueprint.batch_day,
        batch_window="90-minute prep block",
        today_focus=blueprint.meals[0].prep_focus,
        leftover_strategy=blueprint.leftover_strategy,
        steps=[
            NutritionCookingStep(
                title=str(step["title"]),
                detail=str(step["detail"]),
                meal_days=list(step["meal_days"]),
                effort=str(step["effort"]),
                equipment=list(step["equipment"]),
            )
            for step in blueprint.cooking_steps
        ],
    )


def _resolve_blueprint() -> tuple[MarketNutritionBlueprint, str]:
    localization = shared_state.get_localization()
    market_code = localization.market
    currency_code = localization.currency
    return _market_blueprints()[market_code], currency_code


def _format_money(amount: float, currency_code: str) -> str:
    rounded = int(round(amount))
    return f"{currency_code} {rounded:,}"


def _budget_impact_in_currency(amount_usd: str, currency_code: str) -> str:
    low_text, high_text = amount_usd.split("-")
    low = float(low_text)
    high = float(high_text)
    low_value = _convert_from_usd(low, currency_code)
    high_value = _convert_from_usd(high, currency_code)
    return f"Save {_format_money(low_value, currency_code)}-{_format_money(high_value, currency_code)}"


def _convert_from_usd(amount_usd: float, currency_code: str) -> float:
    rate = _FX_RATES_TO_USD.get(currency_code, 1.0)
    return amount_usd / rate


def _market_blueprints() -> dict[str, MarketNutritionBlueprint]:
    market_names = {market.code: market.name for market in build_market_registry()}
    return {
        "IN": MarketNutritionBlueprint(
            market_code="IN",
            market_label=market_names["IN"],
            cuisine="indian",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with 2 leftover lunches",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=1850,
            projected_spend_amount=1640,
            target_summary=NutritionTargetSummary(
                calories=2250,
                protein_grams=132,
                fiber_grams=31,
                hydration_ml=2500,
            ),
            planner_summary=(
                "The India blueprint leans on dal, rice, oats, eggs, paneer, and vegetables to keep cost low while "
                "still covering protein and fiber targets with light weekday cooking."
            ),
            leftover_strategy="Use Sunday and Wednesday dinners as the main leftover anchors for the following lunches.",
            market_note="This setup is tuned for low-cost Indian staples and short weekday cooking windows.",
            strategy_summary="Favor shared staples first, then swap higher-cost proteins only when the weekly total drifts.",
            cost_focus=[
                NutritionCostFocusItem(
                    label="Protein floor",
                    detail="Paneer, eggs, and dal keep protein stable without requiring meat at every meal.",
                ),
                NutritionCostFocusItem(
                    label="Waste control",
                    detail="Vegetables repeat across lunch and dinner so the produce basket stays compact.",
                ),
                NutritionCostFocusItem(
                    label="Time saver",
                    detail="Two dinners are intentionally batch-friendly so lunches need less active cooking.",
                ),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Overnight oats with banana", "Rice, dal, sauteed vegetables", "Chicken and vegetable skillet", "Portion breakfast jars and chop onions, tomatoes, and greens.", 30, "Cook extra chicken for Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Eggs and toast", "Leftover chicken rice bowl", "One-pot vegetable khichdi", "Use leftover chicken first to keep weekday cooking short.", 25, "Khichdi carries into Wednesday lunch if needed."),
                WeeklyMealTemplate("Wed", "Yogurt with fruit and peanuts", "Paneer wrap with salad", "Batch-cooked chickpea curry", "Prep chickpeas and spice base in one pass.", 35, "Chickpea curry covers Thursday lunch."),
                WeeklyMealTemplate("Thu", "Masala oats", "Leftover chickpea curry bowl", "Quick egg bhurji with roti", "Hold dinner to a single-pan cook night.", 18, "No deliberate leftovers; reset the fridge."),
                WeeklyMealTemplate("Fri", "Curd, fruit, and peanuts", "Rice bowl with paneer and vegetables", "Dal khichdi with cucumber salad", "Use the remaining cooked rice and produce together.", 24, "Dal khichdi can stretch into Saturday lunch."),
                WeeklyMealTemplate("Sat", "Vegetable omelette", "Leftover dal khichdi", "Chicken stir-fry with rice", "Refresh proteins before the next batch day.", 28, "Cook one extra portion for Sunday lunch."),
                WeeklyMealTemplate("Sun", "Peanut banana oats", "Leftover chicken stir-fry bowl", "Paneer and vegetable pulao", "Run the main weekly prep block before dinner.", 40, "Sunday dinner becomes the next Monday backup."),
            ],
            shopping_items=[
                {"name": "Rolled oats", "quantity": "1 kg", "estimated_cost_amount": 180, "category": "Breakfast staples", "priority": "high", "used_in_days": ["Mon", "Thu", "Sun"]},
                {"name": "Eggs", "quantity": "18", "estimated_cost_amount": 144, "category": "Protein", "priority": "high", "used_in_days": ["Tue", "Thu", "Sat"]},
                {"name": "Rice", "quantity": "2.5 kg", "estimated_cost_amount": 180, "category": "Grains", "priority": "high", "used_in_days": ["Mon", "Tue", "Fri", "Sat", "Sun"]},
                {"name": "Dal and chickpeas", "quantity": "2 kg combined", "estimated_cost_amount": 280, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Wed", "Fri"]},
                {"name": "Chicken", "quantity": "1.4 kg", "estimated_cost_amount": 460, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Sat"]},
                {"name": "Paneer", "quantity": "500 g", "estimated_cost_amount": 220, "category": "Protein", "priority": "medium", "used_in_days": ["Wed", "Fri", "Sun"]},
                {"name": "Mixed vegetables", "quantity": "3 kg", "estimated_cost_amount": 330, "category": "Produce", "priority": "high", "used_in_days": ["Mon", "Tue", "Wed", "Fri", "Sun"]},
                {"name": "Curd, bananas, peanuts", "quantity": "7 breakfast servings", "estimated_cost_amount": 166, "category": "Breakfast staples", "priority": "medium", "used_in_days": ["Mon", "Wed", "Fri", "Sun"]},
            ],
            substitutions=[
                {"ingredient": "Chicken breast", "substitute": "Eggs or dal", "reason": "Keeps weekday protein flexible at a lower total cost.", "budget_impact_usd": "2-4", "swap_category": "protein"},
                {"ingredient": "Greek yogurt", "substitute": "Curd", "reason": "More available locally and easier to reuse across breakfasts.", "budget_impact_usd": "1-2", "swap_category": "breakfast"},
                {"ingredient": "Quinoa", "substitute": "Rice or millets", "reason": "Lowers spend without changing the overall planner rhythm.", "budget_impact_usd": "2-3", "swap_category": "grains"},
            ],
            cooking_steps=[
                {"title": "Prep grains and legumes", "detail": "Cook the first rice batch and soak or pressure-cook dal/chickpeas together.", "meal_days": ["Mon", "Tue", "Wed"], "effort": "medium", "equipment": ["pot", "pressure cooker"]},
                {"title": "Stage breakfast jars", "detail": "Set up oats, bananas, peanuts, and curd portions for the first half of the week.", "meal_days": ["Mon", "Tue", "Wed"], "effort": "low", "equipment": ["containers"]},
                {"title": "Anchor two batch dinners", "detail": "Use the chickpea curry and paneer pulao nights to create the next day's lunch automatically.", "meal_days": ["Wed", "Sun"], "effort": "medium", "equipment": ["pan", "pot"]},
            ],
        ),
        "US": MarketNutritionBlueprint(
            market_code="US",
            market_label=market_names["US"],
            cuisine="continental",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with 3 prep-heavy dinners",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=95,
            projected_spend_amount=82,
            target_summary=NutritionTargetSummary(calories=2300, protein_grams=140, fiber_grams=33, hydration_ml=2600),
            planner_summary="The United States blueprint uses oats, eggs, beans, chicken, and frozen vegetables to stay low-cost and batch-friendly.",
            leftover_strategy="Cook once on Sunday and Wednesday, then convert those dinners into the next day's grain bowls or wraps.",
            market_note="This setup stays close to a generic low-cost US grocery basket with freezer-friendly ingredients.",
            strategy_summary="Use frozen produce and beans to stabilize both spend and prep time before swapping proteins.",
            cost_focus=[
                NutritionCostFocusItem(label="Batch dinner bias", detail="Large dinners reduce both weekday prep and impulse spend."),
                NutritionCostFocusItem(label="Freezer support", detail="Frozen vegetables help keep waste lower than a produce-only basket."),
                NutritionCostFocusItem(label="Stable breakfast", detail="Oats and eggs keep the morning pattern cheap and repeatable."),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Overnight oats with berries", "Bean and rice bowl", "Sheet-pan chicken and vegetables", "Prep the first sheet-pan dinner for two meals.", 30, "Leftover chicken becomes Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Egg scramble and toast", "Leftover chicken bowl", "Turkey chili", "Use one-pot cooking to keep cleanup low.", 28, "Turkey chili carries into Wednesday lunch."),
                WeeklyMealTemplate("Wed", "Greek yogurt with oats", "Leftover turkey chili", "Pasta with lentil tomato sauce", "Reset the fridge with a meat-light dinner.", 26, "Lentil sauce becomes Thursday lunch."),
                WeeklyMealTemplate("Thu", "Peanut butter oatmeal", "Leftover lentil pasta", "Egg fried rice with vegetables", "Use remaining cooked rice and frozen vegetables.", 20, "No planned leftovers."),
                WeeklyMealTemplate("Fri", "Yogurt, banana, nuts", "Chicken wrap with slaw", "Bean tacos with salsa", "Finish the vegetable basket before the weekend.", 22, "Extra beans can stretch into Saturday lunch."),
                WeeklyMealTemplate("Sat", "Veggie omelette", "Leftover bean taco bowl", "Chicken pasta skillet", "Make the second major protein batch.", 30, "Skillet leftovers become Sunday lunch."),
                WeeklyMealTemplate("Sun", "Oats with peanut butter", "Leftover chicken pasta", "Bean and rice casserole", "Run the main prep block while resetting staples.", 38, "Sunday casserole becomes Monday backup."),
            ],
            shopping_items=[
                {"name": "Rolled oats", "quantity": "42 oz", "estimated_cost_amount": 6, "category": "Breakfast staples", "priority": "high", "used_in_days": ["Mon", "Thu", "Sun"]},
                {"name": "Eggs", "quantity": "18", "estimated_cost_amount": 5, "category": "Protein", "priority": "high", "used_in_days": ["Tue", "Thu", "Sat"]},
                {"name": "Rice and pasta", "quantity": "1 large bag + 1 box", "estimated_cost_amount": 9, "category": "Grains", "priority": "high", "used_in_days": ["Mon", "Tue", "Wed", "Thu", "Sun"]},
                {"name": "Beans and lentils", "quantity": "5 cans / 1 bag", "estimated_cost_amount": 10, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Wed", "Fri", "Sun"]},
                {"name": "Chicken and turkey", "quantity": "4.5 lb combined", "estimated_cost_amount": 24, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Tue", "Fri", "Sat"]},
                {"name": "Frozen mixed vegetables", "quantity": "4 bags", "estimated_cost_amount": 12, "category": "Produce", "priority": "high", "used_in_days": ["Mon", "Thu", "Sat"]},
                {"name": "Fresh produce", "quantity": "lettuce, onions, tomatoes, berries, bananas", "estimated_cost_amount": 11, "category": "Produce", "priority": "medium", "used_in_days": ["Mon", "Fri", "Sat"]},
                {"name": "Yogurt and peanut butter", "quantity": "1 tub + 1 jar", "estimated_cost_amount": 5, "category": "Breakfast staples", "priority": "medium", "used_in_days": ["Wed", "Fri", "Sun"]},
            ],
            substitutions=[
                {"ingredient": "Ground turkey", "substitute": "Beans or lentils", "reason": "Lowers weekly spend while keeping meal volume high.", "budget_impact_usd": "3-5", "swap_category": "protein"},
                {"ingredient": "Fresh berries", "substitute": "Bananas or frozen fruit", "reason": "More stable cost and less waste risk.", "budget_impact_usd": "2-4", "swap_category": "produce"},
                {"ingredient": "Bagged salad kits", "substitute": "Cabbage slaw mix", "reason": "Keeps wraps and bowls crisp at a lower price point.", "budget_impact_usd": "2-3", "swap_category": "produce"},
            ],
            cooking_steps=[
                {"title": "Start with batch grains", "detail": "Cook a large rice batch for bowls, fried rice, and Sunday casserole.", "meal_days": ["Mon", "Thu", "Sun"], "effort": "low", "equipment": ["pot", "containers"]},
                {"title": "Anchor two one-pot proteins", "detail": "Use sheet-pan chicken and turkey chili as the week's main lunch carryovers.", "meal_days": ["Mon", "Tue"], "effort": "medium", "equipment": ["sheet pan", "pot"]},
                {"title": "Hold a freezer fallback lane", "detail": "Frozen vegetables and beans can replace one fresh dinner without changing the plan structure.", "meal_days": ["Thu", "Fri"], "effort": "low", "equipment": ["pan"]},
            ],
        ),
        "UK": MarketNutritionBlueprint(
            market_code="UK",
            market_label=market_names["UK"],
            cuisine="continental",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with simple lunch repeats",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=72,
            projected_spend_amount=61,
            target_summary=NutritionTargetSummary(calories=2200, protein_grams=132, fiber_grams=30, hydration_ml=2400),
            planner_summary="The UK blueprint keeps the plan anchored on oats, eggs, lentils, chicken, and potatoes to stay affordable and low-effort.",
            leftover_strategy="Use lentil stew and roast chicken as the main dinner-to-lunch handoffs.",
            market_note="This setup assumes a broad UK supermarket basket with low-cost staples and repeat lunches.",
            strategy_summary="Protect the weekly total by repeating lunches and swapping premium dairy or meat first.",
            cost_focus=[
                NutritionCostFocusItem(label="Simple lunches", detail="Planned repeats lower both cost and decision fatigue."),
                NutritionCostFocusItem(label="Roast carryover", detail="One roast session feeds multiple meals."),
                NutritionCostFocusItem(label="Potato base", detail="Potatoes and oats keep the starch basket inexpensive."),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Porridge with banana", "Lentil soup and toast", "Roast chicken tray bake", "Start with the main roast anchor.", 35, "Roast chicken becomes Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Eggs on toast", "Leftover roast chicken wrap", "Lentil and vegetable stew", "Use one pot for dinner and tomorrow's lunch.", 28, "Stew becomes Wednesday lunch."),
                WeeklyMealTemplate("Wed", "Yogurt with oats", "Leftover lentil stew", "Jacket potatoes with beans", "Keep the midweek dinner cheap and low-cleanup.", 20, "No planned leftovers."),
                WeeklyMealTemplate("Thu", "Peanut butter porridge", "Chicken rice bowl", "Pasta with tomato lentil sauce", "Use remaining roast pieces and pantry pasta.", 24, "Lentil sauce stretches into Friday lunch."),
                WeeklyMealTemplate("Fri", "Fruit and yogurt", "Leftover lentil pasta", "Vegetable omelette and potatoes", "Finish the week's produce before the weekend.", 18, "Extra potatoes hold for Saturday breakfast."),
                WeeklyMealTemplate("Sat", "Egg and potato hash", "Bean and slaw sandwich", "Chicken curry with rice", "Run a second protein-heavy dinner.", 32, "Chicken curry becomes Sunday lunch."),
                WeeklyMealTemplate("Sun", "Porridge with fruit", "Leftover chicken curry bowl", "Vegetable chilli and rice", "Prep the next week's grains and chopped vegetables.", 34, "Sunday chilli becomes Monday backup."),
            ],
            shopping_items=[
                {"name": "Oats", "quantity": "1 kg", "estimated_cost_amount": 2.5, "category": "Breakfast staples", "priority": "high", "used_in_days": ["Mon", "Thu", "Sun"]},
                {"name": "Eggs", "quantity": "15", "estimated_cost_amount": 3.4, "category": "Protein", "priority": "high", "used_in_days": ["Tue", "Fri", "Sat"]},
                {"name": "Rice and pasta", "quantity": "2 pantry packs", "estimated_cost_amount": 4.6, "category": "Grains", "priority": "high", "used_in_days": ["Thu", "Sat", "Sun"]},
                {"name": "Lentils and beans", "quantity": "2 kg combined", "estimated_cost_amount": 6.2, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Tue", "Wed", "Sun"]},
                {"name": "Chicken", "quantity": "1.6 kg", "estimated_cost_amount": 14.5, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Thu", "Sat"]},
                {"name": "Potatoes", "quantity": "2.5 kg", "estimated_cost_amount": 3.1, "category": "Produce", "priority": "high", "used_in_days": ["Wed", "Fri", "Sat"]},
                {"name": "Vegetables and fruit", "quantity": "weekly basket", "estimated_cost_amount": 18.7, "category": "Produce", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Yogurt, bread, peanut butter", "quantity": "weekly basket", "estimated_cost_amount": 8, "category": "Breakfast staples", "priority": "medium", "used_in_days": ["Mon", "Wed", "Fri"]},
            ],
            substitutions=[
                {"ingredient": "Chicken thighs", "substitute": "More lentils and eggs", "reason": "Keeps protein up if the meat aisle price jumps.", "budget_impact_usd": "3-5", "swap_category": "protein"},
                {"ingredient": "Greek yogurt", "substitute": "Plain yogurt", "reason": "Lower cost with similar breakfast utility.", "budget_impact_usd": "1-2", "swap_category": "breakfast"},
                {"ingredient": "Bagged mixed leaves", "substitute": "Cabbage or carrots", "reason": "Longer shelf life and lower waste risk.", "budget_impact_usd": "1-3", "swap_category": "produce"},
            ],
            cooking_steps=[
                {"title": "Run the roast anchor", "detail": "Roast chicken with potatoes and vegetables to cover the first dinner and next lunch.", "meal_days": ["Mon", "Tue"], "effort": "medium", "equipment": ["oven tray"]},
                {"title": "Hold one pot lentils midweek", "detail": "Cook lentil stew and reuse it across dinner and lunch without adding extra pans.", "meal_days": ["Tue", "Wed"], "effort": "low", "equipment": ["pot"]},
                {"title": "Reset for weekend curry", "detail": "Use the Saturday curry as the last major prep block before Sunday's vegetable chilli.", "meal_days": ["Sat", "Sun"], "effort": "medium", "equipment": ["pot", "pan"]},
            ],
        ),
        "EU": MarketNutritionBlueprint(
            market_code="EU",
            market_label=market_names["EU"],
            cuisine="continental",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with 2 planned batch dinners",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=78,
            projected_spend_amount=66,
            target_summary=NutritionTargetSummary(calories=2200, protein_grams=128, fiber_grams=32, hydration_ml=2400),
            planner_summary="The Europe blueprint balances oats, eggs, legumes, chicken, and vegetables to stay flexible across English, French, and German shells.",
            leftover_strategy="Use vegetable ragout and roast chicken as the main leftover bridges into lunch.",
            market_note="This setup is tuned for a generic Europe market profile with EUR pricing and pantry-friendly staples.",
            strategy_summary="Keep the pantry modular enough for different cuisines while preserving one low-cost weekly structure.",
            cost_focus=[
                NutritionCostFocusItem(label="Pan-European staples", detail="Oats, legumes, eggs, and roast vegetables travel well across cuisines."),
                NutritionCostFocusItem(label="Two anchor dinners", detail="One roast and one bean-based stew carry the lunch plan."),
                NutritionCostFocusItem(label="Budget buffer", detail="A small margin stays in place for dairy or produce variation by city."),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Oats with fruit", "Lentil salad bowl", "Roast chicken with vegetables", "Start with the roast anchor to cover lunch carryover.", 35, "Roast leftovers become Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Eggs and toast", "Leftover roast chicken bowl", "Bean and tomato ragout", "Use one pot and extra beans for tomorrow.", 27, "Ragout becomes Wednesday lunch."),
                WeeklyMealTemplate("Wed", "Yogurt and oats", "Leftover bean ragout", "Pasta with vegetable sauce", "Hold dinner to a pantry-led low-cleanup meal.", 22, "Sauce can stretch if Thursday runs long."),
                WeeklyMealTemplate("Thu", "Fruit and nuts", "Chicken wrap with salad", "Vegetable frittata with potatoes", "Use eggs to avoid another meat-heavy dinner.", 24, "No major leftovers planned."),
                WeeklyMealTemplate("Fri", "Overnight oats", "Pasta leftovers or lentil bowl", "Chickpea tray bake", "Finish the produce basket before the weekend.", 26, "Chickpeas can stretch into Saturday lunch."),
                WeeklyMealTemplate("Sat", "Vegetable omelette", "Leftover chickpea tray bake", "Chicken rice skillet", "Refresh proteins with a second chicken cook.", 30, "Chicken skillet becomes Sunday lunch."),
                WeeklyMealTemplate("Sun", "Yogurt, oats, fruit", "Leftover chicken rice bowl", "Bean soup and toast", "Use Sunday to reset staples for the next week.", 32, "Soup becomes the next Monday fallback."),
            ],
            shopping_items=[
                {"name": "Oats", "quantity": "1 kg", "estimated_cost_amount": 3.5, "category": "Breakfast staples", "priority": "high", "used_in_days": ["Mon", "Wed", "Fri", "Sun"]},
                {"name": "Eggs", "quantity": "15", "estimated_cost_amount": 4.5, "category": "Protein", "priority": "high", "used_in_days": ["Tue", "Thu", "Sat"]},
                {"name": "Pasta, rice, potatoes", "quantity": "3 pantry items", "estimated_cost_amount": 10.5, "category": "Grains", "priority": "high", "used_in_days": ["Wed", "Thu", "Sat"]},
                {"name": "Lentils, beans, chickpeas", "quantity": "2 kg combined", "estimated_cost_amount": 11.5, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Tue", "Fri", "Sun"]},
                {"name": "Chicken", "quantity": "1.8 kg", "estimated_cost_amount": 19.5, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Thu", "Sat"]},
                {"name": "Vegetables", "quantity": "weekly basket", "estimated_cost_amount": 12, "category": "Produce", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Fruit, yogurt, nuts", "quantity": "weekly breakfast basket", "estimated_cost_amount": 10, "category": "Breakfast staples", "priority": "medium", "used_in_days": ["Mon", "Wed", "Sun"]},
            ],
            substitutions=[
                {"ingredient": "Chicken", "substitute": "Extra legumes and eggs", "reason": "Keeps the weekly budget stable when meat prices vary by city.", "budget_impact_usd": "3-6", "swap_category": "protein"},
                {"ingredient": "Yogurt cups", "substitute": "One large plain tub", "reason": "Lower packaging cost and easier breakfast batching.", "budget_impact_usd": "1-2", "swap_category": "breakfast"},
                {"ingredient": "Fresh herbs", "substitute": "Dried herb blend", "reason": "Reduces waste if the same herb is not reused enough.", "budget_impact_usd": "1-2", "swap_category": "produce"},
            ],
            cooking_steps=[
                {"title": "Cook the roast anchor first", "detail": "Roast chicken and vegetables to create one dinner and one lunch handoff.", "meal_days": ["Mon", "Tue"], "effort": "medium", "equipment": ["oven tray"]},
                {"title": "Run the bean ragout lane", "detail": "Use tomatoes, beans, and onions as a reusable base for both lunch and dinner.", "meal_days": ["Tue", "Wed"], "effort": "low", "equipment": ["pot"]},
                {"title": "Reset with a Sunday soup", "detail": "Finish remaining vegetables in a final soup so the next week starts with less waste.", "meal_days": ["Sun"], "effort": "low", "equipment": ["pot", "containers"]},
            ],
        ),
        "CN": MarketNutritionBlueprint(
            market_code="CN",
            market_label=market_names["CN"],
            cuisine="chinese",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with rice-led batch cooking",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=420,
            projected_spend_amount=356,
            target_summary=NutritionTargetSummary(calories=2250, protein_grams=130, fiber_grams=30, hydration_ml=2400),
            planner_summary="The China blueprint keeps the plan centered on rice, eggs, tofu, chicken, and vegetables for simple batch cooking and low utensil use.",
            leftover_strategy="Use rice and stir-fry bases twice before introducing a new protein prep block.",
            market_note="This setup assumes a broad China market basket with rice, tofu, eggs, and vegetable-heavy weekday meals.",
            strategy_summary="Repeat rice and tofu patterns first, then use chicken as a controlled higher-cost protein lane.",
            cost_focus=[
                NutritionCostFocusItem(label="Rice reuse", detail="A single rice batch supports bowls, stir-fries, and fried rice."),
                NutritionCostFocusItem(label="Tofu lane", detail="Tofu protects both cost and cooking speed during the week."),
                NutritionCostFocusItem(label="Low utensil flow", detail="Most dinners stay within one wok or pan plus one pot."),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Soy milk oats with fruit", "Rice with tofu and greens", "Chicken and vegetable stir-fry", "Cook the first rice batch and slice vegetables early.", 28, "Extra stir-fry becomes Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Eggs and steamed buns", "Leftover chicken rice bowl", "Tomato egg tofu skillet", "Hold dinner to a fast wok meal.", 18, "No planned leftovers."),
                WeeklyMealTemplate("Wed", "Yogurt with fruit", "Noodles with vegetables and tofu", "Batch mapo-style tofu", "Use tofu as the main batch anchor.", 24, "Mapo tofu becomes Thursday lunch."),
                WeeklyMealTemplate("Thu", "Peanut oats", "Leftover tofu rice bowl", "Fried rice with eggs and vegetables", "Reuse the remaining rice before cooking a new batch.", 20, "No planned leftovers."),
                WeeklyMealTemplate("Fri", "Soy milk and fruit", "Chicken noodle bowl", "Braised tofu and mushrooms", "Use tofu again to control the weekly spend.", 26, "Tofu can stretch into Saturday lunch."),
                WeeklyMealTemplate("Sat", "Vegetable omelette", "Leftover braised tofu bowl", "Chicken and cabbage noodles", "Refresh the protein lane with one larger chicken dinner.", 30, "Cook one extra portion for Sunday lunch."),
                WeeklyMealTemplate("Sun", "Oats with banana", "Leftover chicken noodles", "Rice congee and vegetable sides", "Run the weekly reset with rice and chopped vegetables.", 34, "Congee becomes Monday backup."),
            ],
            shopping_items=[
                {"name": "Rice", "quantity": "3 kg", "estimated_cost_amount": 42, "category": "Grains", "priority": "high", "used_in_days": ["Mon", "Tue", "Thu", "Sun"]},
                {"name": "Eggs", "quantity": "18", "estimated_cost_amount": 20, "category": "Protein", "priority": "high", "used_in_days": ["Tue", "Thu", "Sat"]},
                {"name": "Tofu", "quantity": "6 blocks", "estimated_cost_amount": 30, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Wed", "Fri"]},
                {"name": "Chicken", "quantity": "1.5 kg", "estimated_cost_amount": 58, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Fri", "Sat"]},
                {"name": "Noodles and buns", "quantity": "weekly basket", "estimated_cost_amount": 32, "category": "Grains", "priority": "medium", "used_in_days": ["Tue", "Wed", "Fri", "Sat"]},
                {"name": "Vegetables and mushrooms", "quantity": "weekly basket", "estimated_cost_amount": 118, "category": "Produce", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Fruit, yogurt, soy milk, peanuts", "quantity": "weekly breakfast basket", "estimated_cost_amount": 56, "category": "Breakfast staples", "priority": "medium", "used_in_days": ["Mon", "Wed", "Fri", "Sun"]},
            ],
            substitutions=[
                {"ingredient": "Chicken", "substitute": "Tofu and eggs", "reason": "Keeps the weekly spend more stable while preserving easy stir-fry structure.", "budget_impact_usd": "3-6", "swap_category": "protein"},
                {"ingredient": "Fresh noodles", "substitute": "Rice or dried noodles", "reason": "Simpler pantry storage and lower waste risk.", "budget_impact_usd": "1-2", "swap_category": "grains"},
                {"ingredient": "Yogurt cups", "substitute": "Soy milk or plain yogurt tub", "reason": "Supports breakfast repetition at lower cost.", "budget_impact_usd": "1-2", "swap_category": "breakfast"},
            ],
            cooking_steps=[
                {"title": "Cook the rice base first", "detail": "Use one large rice batch to support bowls, fried rice, and congee.", "meal_days": ["Mon", "Thu", "Sun"], "effort": "low", "equipment": ["pot", "rice cooker"]},
                {"title": "Rotate tofu before chicken", "detail": "Hold tofu as the default weekday protein lane and add chicken only twice.", "meal_days": ["Mon", "Wed", "Fri"], "effort": "low", "equipment": ["wok", "pan"]},
                {"title": "Keep one wok clean lane", "detail": "Most dinners should stay within one wok plus one rice or noodle base.", "meal_days": ["Tue", "Thu", "Sat"], "effort": "low", "equipment": ["wok"]},
            ],
        ),
        "JP": MarketNutritionBlueprint(
            market_code="JP",
            market_label=market_names["JP"],
            cuisine="japanese",
            week_label="Week of July 13, 2026",
            schedule_label="3 meals daily with rice- and miso-anchored batch cooking",
            cooking_cadence="Cook 4 times across the week",
            batch_day="Sunday",
            days_to_cook=4,
            budget_amount=13500,
            projected_spend_amount=11800,
            target_summary=NutritionTargetSummary(calories=2200, protein_grams=125, fiber_grams=28, hydration_ml=2400),
            planner_summary=(
                "The Japan blueprint keeps the week anchored on rice, miso, tofu, egg, and grilled or simmered "
                "fish and chicken, with simple one-pot simmered dishes carrying most of the leftover lunches."
            ),
            leftover_strategy="Use Sunday's simmered dish and Wednesday's donburi as the main leftover anchors for the following lunches.",
            market_note="This setup assumes a standard Japan supermarket basket - rice, miso, tofu, eggs, and seasonal vegetables.",
            strategy_summary="Keep rice and miso soup as the fixed daily base, then rotate a single protein lane to control cost.",
            cost_focus=[
                NutritionCostFocusItem(label="Rice and miso base", detail="A shared rice batch and one miso stock cover breakfast and most lunches."),
                NutritionCostFocusItem(label="Protein rotation", detail="Tofu and eggs anchor most days; fish and chicken appear only twice each to control cost."),
                NutritionCostFocusItem(label="One-pot simmering", detail="Nimono-style simmered dishes reheat well, so dinner effort stays low midweek."),
            ],
            meals=[
                WeeklyMealTemplate("Mon", "Rice, miso soup, and natto", "Onigiri with pickled vegetables", "Teriyaki chicken with steamed cabbage", "Cook the weekly rice batch and prep teriyaki sauce.", 30, "Extra chicken becomes Tuesday lunch."),
                WeeklyMealTemplate("Tue", "Tamagoyaki and rice", "Leftover teriyaki chicken rice bowl", "Miso-glazed salmon with rice", "Keep dinner to a single grill pan for the salmon.", 20, "No planned leftovers."),
                WeeklyMealTemplate("Wed", "Rice, miso soup, and grilled fish", "Salmon and vegetable donburi", "Simmered tofu and vegetable nimono", "Use the simmered nimono as the main batch anchor.", 25, "Nimono carries into Thursday lunch."),
                WeeklyMealTemplate("Thu", "Natto rice and miso soup", "Leftover tofu nimono bowl", "Yakitori-style chicken skewers with rice", "Skewer and grill chicken in one batch for speed.", 22, "No planned leftovers."),
                WeeklyMealTemplate("Fri", "Rice, miso soup, and tamagoyaki", "Yakitori chicken rice bowl", "Udon noodle soup with tofu and greens", "Keep dinner to a single pot of udon broth.", 18, "Udon broth can stretch into Saturday lunch."),
                WeeklyMealTemplate("Sat", "Rice porridge with pickles", "Leftover udon noodle soup", "Chicken and vegetable curry rice", "Cook a larger curry batch for the weekend and Sunday lunch.", 32, "Extra curry becomes Sunday lunch."),
                WeeklyMealTemplate("Sun", "Rice, miso soup, and grilled fish", "Leftover chicken curry rice", "Simmered pork and daikon nimono", "Run the main weekly prep block: rice batch, miso stock, and Sunday's simmered dish.", 40, "Sunday's nimono becomes the next Monday backup."),
            ],
            shopping_items=[
                {"name": "Rice", "quantity": "3.5 kg", "estimated_cost_amount": 1800, "category": "Grains", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Miso paste and dashi stock", "quantity": "weekly basket", "estimated_cost_amount": 900, "category": "Pantry", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Eggs", "quantity": "12", "estimated_cost_amount": 380, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Tue", "Fri"]},
                {"name": "Tofu and natto", "quantity": "6 blocks + 3 packs", "estimated_cost_amount": 750, "category": "Protein", "priority": "high", "used_in_days": ["Mon", "Thu", "Wed"]},
                {"name": "Chicken thigh", "quantity": "1.2 kg", "estimated_cost_amount": 960, "category": "Protein", "priority": "medium", "used_in_days": ["Mon", "Thu", "Fri", "Sat"]},
                {"name": "Salmon fillets", "quantity": "4", "estimated_cost_amount": 1400, "category": "Protein", "priority": "medium", "used_in_days": ["Tue", "Wed"]},
                {"name": "Pork slices", "quantity": "500 g", "estimated_cost_amount": 850, "category": "Protein", "priority": "low", "used_in_days": ["Sun"]},
                {"name": "Udon noodles", "quantity": "4 servings", "estimated_cost_amount": 480, "category": "Grains", "priority": "medium", "used_in_days": ["Fri"]},
                {"name": "Vegetables (cabbage, daikon, greens)", "quantity": "weekly basket", "estimated_cost_amount": 2200, "category": "Produce", "priority": "high", "used_in_days": ["All week"]},
                {"name": "Pickles and seasonings", "quantity": "weekly basket", "estimated_cost_amount": 1400, "category": "Pantry", "priority": "medium", "used_in_days": ["All week"]},
            ],
            substitutions=[
                {"ingredient": "Salmon", "substitute": "Mackerel or tofu", "reason": "Keeps the weekly spend more stable while preserving the grilled-fish structure.", "budget_impact_usd": "3-6", "swap_category": "protein"},
                {"ingredient": "Pork slices", "substitute": "Extra chicken thigh", "reason": "Simplifies the protein shopping list to one main lane.", "budget_impact_usd": "1-3", "swap_category": "protein"},
                {"ingredient": "Fresh udon", "substitute": "Dried udon or soba", "reason": "Longer pantry life and lower waste risk.", "budget_impact_usd": "1-2", "swap_category": "grains"},
            ],
            cooking_steps=[
                {"title": "Cook the rice and miso stock base first", "detail": "One rice batch and one dashi/miso stock cover breakfast and most lunches all week.", "meal_days": ["Mon", "Wed", "Sun"], "effort": "low", "equipment": ["rice cooker", "pot"]},
                {"title": "Batch the Sunday simmered dish", "detail": "Nimono-style simmered tofu or pork keeps well and anchors two lunches.", "meal_days": ["Wed", "Sun"], "effort": "medium", "equipment": ["pot"]},
                {"title": "Grill proteins in one pass", "detail": "Salmon, teriyaki chicken, and yakitori skewers all use the same grill pan across the week.", "meal_days": ["Mon", "Tue", "Thu"], "effort": "low", "equipment": ["grill pan", "skewers"]},
            ],
        ),
    }
