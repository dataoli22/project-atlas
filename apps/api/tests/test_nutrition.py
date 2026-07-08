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
