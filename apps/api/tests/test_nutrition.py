from datetime import date, datetime, timedelta, timezone


def _parse_iso(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def test_nutrition_planner_returns_seven_day_calendar_and_resources(client):
    response = client.get("/api/v1/nutrition/planner")

    assert response.status_code == 200
    payload = response.json()

    calendar_days = payload["calendar_days"]
    assert len(calendar_days) == 7
    for day in calendar_days:
        assert len(day["meals"]) == 3
        assert [meal["slot"] for meal in day["meals"]] == ["breakfast", "lunch", "dinner"]
        assert day["date"]
        assert day["status"] in {"current", "refreshing", "stale", "failed"}

    # Batch day is marked and carries a prep window.
    batch_days = [day for day in calendar_days if day["is_batch_day"]]
    assert len(batch_days) == 1
    assert batch_days[0]["prep_window"]

    # Leftover carryover is derived from the blueprint.
    assert any(
        meal["is_leftover"] for day in calendar_days for meal in day["meals"]
    )
    assert any(day["leftover_into"] for day in calendar_days)

    assert len(payload["meal_prep_hacks"]) >= 1
    for hack in payload["meal_prep_hacks"]:
        assert hack["title"]
        assert hack["difficulty"] in {"easy", "medium", "advanced"}
        assert hack["estimated_time_saved_minutes"] > 0

    assert len(payload["video_links"]) >= 5
    for link in payload["video_links"]:
        assert link["url"].startswith("https://www.youtube.com/results")
        assert link["why_recommended"]
    assert any(link["market_scope"] == "IN" for link in payload["video_links"])

    assert payload["swap_history"] == []


def test_nutrition_planner_refresh_metadata_is_well_formed(client):
    payload = client.get("/api/v1/nutrition/planner").json()
    refresh = payload["refresh"]

    assert refresh["week_start_date"] == "2026-07-13"
    assert refresh["week_end_date"] == "2026-07-19"
    assert refresh["refresh_interval_days"] == 7
    assert refresh["planner_version"] == "2026.07"
    assert refresh["plan_id"] == "plan-IN-2026-07-13"

    week_start = date(2026, 7, 13)
    expected_due = datetime(
        week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc
    ) + timedelta(days=7)
    assert _parse_iso(refresh["refresh_due_at"]) == expected_due

    expected_is_stale = _parse_iso(refresh["refresh_due_at"]) < datetime.now(timezone.utc)
    assert refresh["is_stale"] is expected_is_stale
    assert refresh["status"] == ("stale" if expected_is_stale else "current")


def test_nutrition_planner_refresh_endpoint_records_history_and_advances(client):
    before = client.get("/api/v1/nutrition/planner").json()
    before_refreshed_at = before["refresh"]["last_refreshed_at"]

    response = client.post(
        "/api/v1/nutrition/planner/refresh",
        json={"reason": "Ran out of paneer"},
    )
    assert response.status_code == 200
    refreshed = response.json()

    assert refreshed["refresh"]["refresh_reason"] == "Ran out of paneer"
    assert refreshed["refresh"]["status"] == "current"
    assert refreshed["refresh"]["is_stale"] is False

    # Outgoing plan preserved in swap history.
    assert len(refreshed["swap_history"]) == 1
    assert refreshed["swap_history"][0]["refreshed_at"] == before_refreshed_at

    # Timestamps advanced to the refresh moment (now), replacing the scheduled default.
    new_refreshed_at = _parse_iso(refreshed["refresh"]["last_refreshed_at"])
    assert refreshed["refresh"]["last_refreshed_at"] != before_refreshed_at
    assert abs((new_refreshed_at - datetime.now(timezone.utc)).total_seconds()) < 5
    expected_due = new_refreshed_at + timedelta(days=7)
    assert abs((_parse_iso(refreshed["refresh"]["refresh_due_at"]) - expected_due).total_seconds()) < 2

    # Persisted overrides are applied on the next GET.
    after_get = client.get("/api/v1/nutrition/planner").json()
    assert after_get["refresh"]["refresh_reason"] == "Ran out of paneer"
    assert len(after_get["swap_history"]) == 1


def test_nutrition_planner_refresh_defaults_reason(client):
    response = client.post("/api/v1/nutrition/planner/refresh")
    assert response.status_code == 200
    assert response.json()["refresh"]["refresh_reason"] == "Manual refresh"


def test_nutrition_planner_returns_richer_weekly_contract(client):
    response = client.get("/api/v1/nutrition/planner")

    assert response.status_code == 200
    payload = response.json()

    assert payload["active_feature"] == "nutrition"
    assert payload["market_code"] == "IN"
    assert payload["currency_code"] == "INR"
    assert payload["days_to_cook"] == 4
    assert payload["nutrition_targets"]["protein_grams"] == 132
    assert len(payload["cost_focus"]) == 3
    assert len(payload["meals"]) == 7
    assert payload["meals"][0]["prep_focus"]
    assert payload["meals"][0]["cook_time_minutes"] > 0
    assert payload["meals"][0]["leftover_plan"]


def test_nutrition_planner_exposes_cuisine_matching_market(client):
    expected_by_market = {
        "IN": ("indian", "INR", "en"),
        "JP": ("japanese", "JPY", "ja"),
        "CN": ("chinese", "CNY", "zh"),
        "US": ("continental", "USD", "en"),
        "UK": ("continental", "GBP", "en"),
        "EU": ("continental", "EUR", "en"),
    }

    for market_code, (expected_cuisine, currency, language) in expected_by_market.items():
        update_response = client.put(
            "/api/v1/settings/localization",
            json={
                "market": market_code,
                "currency": currency,
                "language": language,
                "locale": f"{language}-{market_code}",
                "currency_override": False,
                "language_override": False,
            },
        )
        assert update_response.status_code == 200

        planner_response = client.get("/api/v1/nutrition/planner")
        assert planner_response.status_code == 200
        assert planner_response.json()["cuisine"] == expected_cuisine


def test_nutrition_japan_market_returns_full_weekly_plan(client):
    update_response = client.put(
        "/api/v1/settings/localization",
        json={
            "market": "JP",
            "currency": "JPY",
            "language": "ja",
            "locale": "ja-JP",
            "currency_override": False,
            "language_override": False,
        },
    )
    assert update_response.status_code == 200

    planner_response = client.get("/api/v1/nutrition/planner")
    assert planner_response.status_code == 200
    planner = planner_response.json()

    assert planner["market_code"] == "JP"
    assert planner["market_label"] == "Japan"
    assert planner["currency_code"] == "JPY"
    assert planner["cuisine"] == "japanese"
    assert planner["budget"].startswith("JPY ")
    assert len(planner["meals"]) == 7
    assert all(meal["cook_time_minutes"] > 0 for meal in planner["meals"])
    assert len(planner["calendar_days"]) == 7

    shopping_response = client.get("/api/v1/nutrition/shopping-list")
    assert shopping_response.status_code == 200
    shopping = shopping_response.json()
    assert shopping["total_items"] > 0
    assert shopping["estimated_total"].startswith("JPY ")

    substitutions_response = client.get("/api/v1/nutrition/substitutions")
    assert substitutions_response.status_code == 200
    assert len(substitutions_response.json()["substitutions"]) > 0

    cooking_response = client.get("/api/v1/nutrition/cooking-plan")
    assert cooking_response.status_code == 200
    assert len(cooking_response.json()["steps"]) > 0

    assert any(link["market_scope"] == "JP" for link in planner["video_links"])


def test_nutrition_respects_currency_override_in_localization(client):
    update_response = client.put(
        "/api/v1/settings/localization",
        json={
            "market": "IN",
            "currency": "USD",
            "language": "en",
            "locale": "en-IN",
            "currency_override": True,
            "language_override": False,
        },
    )
    assert update_response.status_code == 200

    planner_response = client.get("/api/v1/nutrition/planner")
    shopping_response = client.get("/api/v1/nutrition/shopping-list")

    assert planner_response.status_code == 200
    assert shopping_response.status_code == 200

    planner = planner_response.json()
    shopping = shopping_response.json()

    assert planner["market_code"] == "IN"
    assert planner["currency_code"] == "USD"
    assert planner["budget"].startswith("USD ")
    assert planner["projected_spend"].startswith("USD ")
    assert shopping["estimated_total"].startswith("USD ")


def test_nutrition_cooking_plan_endpoint_returns_structured_steps(client):
    response = client.get("/api/v1/nutrition/cooking-plan")

    assert response.status_code == 200
    payload = response.json()

    assert payload["active_feature"] == "nutrition"
    assert payload["batch_day"] == "Sunday"
    assert payload["batch_window"] == "90-minute prep block"
    assert payload["today_focus"]
    assert payload["leftover_strategy"]
    assert len(payload["steps"]) >= 3
    assert payload["steps"][0]["meal_days"]
    assert payload["steps"][0]["equipment"]


def test_swap_meal_persists_and_is_reflected_in_planner(client):
    # meal_plan_entries is real, on-disk, cross-test-run persistence (nutrition/service.py's
    # seed-from-blueprint-once model) - unlike most other state this test suite resets per test
    # (see conftest.py's restore_shared_state, which snapshots in-memory shared_state but does not
    # touch the underlying SQLite file). Establish a known baseline via the endpoint itself first,
    # rather than assuming the day's dinner starts at any particular blueprint default.
    baseline = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={"day": "Mon", "slot": "dinner", "dish_name": "Baseline Placeholder Dish", "reason": "test setup"},
    )
    assert baseline.status_code == 200
    before = baseline.json()
    monday = next(meal for meal in before["meals"] if meal["day"] == "Mon")
    assert monday["dinner"] == "Baseline Placeholder Dish"

    response = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={"day": "Mon", "slot": "dinner", "dish_name": "Grilled tofu stir-fry", "reason": "Trying something new"},
    )

    assert response.status_code == 200
    payload = response.json()
    swapped_monday = next(meal for meal in payload["meals"] if meal["day"] == "Mon")
    assert swapped_monday["dinner"] == "Grilled tofu stir-fry"
    # Other slots on the same day are untouched by a single-slot swap.
    assert swapped_monday["breakfast"] == monday["breakfast"]
    assert swapped_monday["lunch"] == monday["lunch"]

    # Swapping again confirms the edit persisted (this isn't a one-shot in-memory mutation).
    again = client.get("/api/v1/nutrition/planner").json()
    monday_again = next(meal for meal in again["meals"] if meal["day"] == "Mon")
    assert monday_again["dinner"] == "Grilled tofu stir-fry"


def test_swap_meal_rejects_unknown_slot(client):
    response = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={"day": "Mon", "slot": "brunch", "dish_name": "Something", "reason": ""},
    )

    assert response.status_code == 400
    assert "slot" in response.json()["detail"].lower()


def test_swap_meal_rejects_unknown_day(client):
    response = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={"day": "Someday", "slot": "dinner", "dish_name": "Something", "reason": ""},
    )

    assert response.status_code == 400
    assert "day" in response.json()["detail"].lower()


def test_nutrition_preferences_default_before_any_save(client):
    response = client.get("/api/v1/nutrition/preferences")
    assert response.status_code == 200
    payload = response.json()
    assert payload["updated_at"] is None
    assert set(payload["meal_types"]) == {"breakfast", "lunch", "dinner"}
    assert payload["shop_frequency_per_week"] >= 1
    assert payload["avg_cook_time_minutes"] > 0
    assert payload["has_real_effect"] == ["meal_types", "allergens"]


def test_nutrition_preferences_post_then_get_round_trip(client):
    post_response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": ["indian", "japanese"],
            "shop_frequency_per_week": 2,
            "meal_types": ["breakfast", "dinner"],
            "avg_cook_time_minutes": 45,
        },
    )
    assert post_response.status_code == 200
    posted = post_response.json()
    assert posted["cuisines"] == ["indian", "japanese"]
    assert posted["shop_frequency_per_week"] == 2
    assert posted["meal_types"] == ["breakfast", "dinner"]
    assert posted["avg_cook_time_minutes"] == 45
    assert posted["updated_at"]

    get_response = client.get("/api/v1/nutrition/preferences")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["cuisines"] == ["indian", "japanese"]
    assert fetched["shop_frequency_per_week"] == 2
    assert fetched["meal_types"] == ["breakfast", "dinner"]
    assert fetched["avg_cook_time_minutes"] == 45


def test_nutrition_preferences_health_conditions_and_allergens_round_trip(client):
    post_response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast", "lunch", "dinner"],
            "avg_cook_time_minutes": 30,
            "health_conditions": ["diabetes", "hypertension"],
            "allergens": ["peanuts", "dairy"],
            "planning_note": 'I want Japanese cuisine this week',
        },
    )
    assert post_response.status_code == 200
    posted = post_response.json()
    assert posted["health_conditions"] == ["diabetes", "hypertension"]
    assert posted["allergens"] == ["peanuts", "dairy"]
    assert posted["planning_note"] == 'I want Japanese cuisine this week'
    assert "allergens" in posted["has_real_effect"]
    assert "health_conditions" in posted["persisted_only"]

    get_response = client.get("/api/v1/nutrition/preferences")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["health_conditions"] == ["diabetes", "hypertension"]
    assert fetched["allergens"] == ["peanuts", "dairy"]


def test_nutrition_preferences_rejects_unknown_allergen(client):
    response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast", "lunch", "dinner"],
            "avg_cook_time_minutes": 30,
            "allergens": ["not-a-real-allergen"],
        },
    )
    assert response.status_code == 400


def test_nutrition_allergen_preference_excludes_matching_shopping_items(client):
    # Reset any allergen preference a previous test in this session may have saved (preferences
    # persist across requests within a test client's shared state) so "before" reflects no filter.
    client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast", "lunch", "dinner"],
            "avg_cook_time_minutes": 30,
            "allergens": [],
        },
    )
    dairy_keywords = ("milk", "cheese", "paneer", "yogurt", "yoghurt", "butter", "cream", "ghee")
    before = client.get("/api/v1/nutrition/shopping-list").json()
    matching_before = [
        item["name"] for item in before["items"] if any(keyword in item["name"].lower() for keyword in dairy_keywords)
    ]
    assert matching_before, "expected at least one dairy-named item in the default market's shopping list"

    post_response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast", "lunch", "dinner"],
            "avg_cook_time_minutes": 30,
            "allergens": ["dairy"],
        },
    )
    assert post_response.status_code == 200

    after = client.get("/api/v1/nutrition/shopping-list").json()
    matching_after = [
        item["name"] for item in after["items"] if any(keyword in item["name"].lower() for keyword in dairy_keywords)
    ]
    assert matching_after == []
    assert after["total_items"] < before["total_items"]


def test_nutrition_preferences_rejects_unknown_cuisine(client):
    response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": ["not-a-real-cuisine"],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast"],
            "avg_cook_time_minutes": 30,
        },
    )
    assert response.status_code == 400
    assert "cuisine" in response.json()["detail"].lower()


def test_nutrition_preferences_meal_type_filter_has_real_effect_on_planner(client):
    save_response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["dinner"],
            "avg_cook_time_minutes": 30,
        },
    )
    assert save_response.status_code == 200

    planner_response = client.get("/api/v1/nutrition/planner")
    assert planner_response.status_code == 200
    payload = planner_response.json()

    for day in payload["calendar_days"]:
        assert [meal["slot"] for meal in day["meals"]] == ["dinner"]

    # Reset to all meal types so this test doesn't leak state into other tests.
    reset_response = client.post(
        "/api/v1/nutrition/preferences",
        json={
            "cuisines": [],
            "shop_frequency_per_week": 1,
            "meal_types": ["breakfast", "lunch", "dinner"],
            "avg_cook_time_minutes": 30,
        },
    )
    assert reset_response.status_code == 200
    reset_planner = client.get("/api/v1/nutrition/planner").json()
    for day in reset_planner["calendar_days"]:
        assert len(day["meals"]) == 3


def test_swapped_meal_ingredients_appear_in_shopping_list(client):
    # No AI provider is configured in tests, so generate_meal_ingredients() falls back to a
    # single ungrounded entry named after the dish itself (confidence=0.0) - that's still a real,
    # honest ingredient row that should show up in the shopping list once swapped.
    dish_name = "Zzz Unique Test Casserole"
    swap_response = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={"day": "Tue", "slot": "lunch", "dish_name": dish_name, "reason": "test"},
    )
    assert swap_response.status_code == 200

    shopping_response = client.get("/api/v1/nutrition/shopping-list")
    assert shopping_response.status_code == 200
    payload = shopping_response.json()

    matching = [item for item in payload["items"] if item["name"] == dish_name]
    assert len(matching) == 1
    assert matching[0]["quantity"] == "As needed"
    assert matching[0]["estimated_cost"] == "Not estimated"
    assert "Tue" in matching[0]["used_in_days"]
