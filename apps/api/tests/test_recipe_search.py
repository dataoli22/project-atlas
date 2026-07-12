import uuid

from app.features.nutrition import service as nutrition_service_module
from app.features.nutrition.data_sources import NutritionSearchHit
from app.features.shared.services.state import shared_state


class _FakeBraveSearchProvider:
    source_name = "brave_search"

    def __init__(self, *, api_key: str) -> None:
        assert api_key == "fake-key"

    def search(self, query, *, market_code, limit):
        return [
            NutritionSearchHit(title=f"Result for {query}", url="https://example.com/recipe", snippet="A recipe.")
        ]


def test_recipe_search_requires_brave_key(client):
    response = client.get("/api/v1/nutrition/recipes/search", params={"query": "paneer tikka"})
    assert response.status_code == 400
    assert "Brave Search API key" in response.json()["detail"]


def test_recipe_search_returns_real_results_and_can_sync_to_plan(client, monkeypatch):
    # The daily rate limit is real, on-disk, cross-test-run persistence (same documented gap as
    # meal_plan_entries in test_nutrition.py) - bypass it here so this test verifies the
    # search-then-sync flow itself, not whatever quota state happens to be left over from other
    # test runs today. Quota enforcement itself is tested in isolation below.
    monkeypatch.setattr(shared_state, "check_and_increment_daily_limit", lambda **_: True)
    monkeypatch.setattr(nutrition_service_module, "BraveSearchProvider", _FakeBraveSearchProvider)
    update_response = client.put("/api/v1/settings/search", json={"brave_api_key": "fake-key"})
    assert update_response.status_code == 200

    search_response = client.get("/api/v1/nutrition/recipes/search", params={"query": "paneer tikka"})
    assert search_response.status_code == 200
    payload = search_response.json()
    assert payload["results"][0]["title"] == "Result for paneer tikka recipe"

    swap_response = client.post(
        "/api/v1/nutrition/planner/swap-meal",
        json={
            "day": "Mon",
            "slot": "dinner",
            "dish_name": payload["results"][0]["title"],
            "reason": "Synced from recipe search",
        },
    )
    assert swap_response.status_code == 200
    monday = next(meal for meal in swap_response.json()["meals"] if meal["day"] == "Mon")
    assert monday["dinner"] == "Result for paneer tikka recipe"


def test_daily_limit_allows_up_to_max_then_blocks():
    # Unit-tests the counting/capping logic in isolation via a fresh, unique limit_key each run -
    # the daily_rate_limits table persists across separate pytest invocations within the same
    # UTC day (same documented gap as elsewhere), so a fixed key would already be exhausted on a
    # second run today.
    limit_key = f"test_daily_limit_isolated_key_{uuid.uuid4().hex}"
    max_per_day = 3

    for _ in range(max_per_day):
        assert shared_state.check_and_increment_daily_limit(limit_key=limit_key, max_per_day=max_per_day) is True

    assert shared_state.check_and_increment_daily_limit(limit_key=limit_key, max_per_day=max_per_day) is False


def test_recipe_search_endpoint_returns_429_when_limit_exhausted(client, monkeypatch):
    monkeypatch.setattr(shared_state, "check_and_increment_daily_limit", lambda **_: False)
    monkeypatch.setattr(nutrition_service_module, "BraveSearchProvider", _FakeBraveSearchProvider)
    client.put("/api/v1/settings/search", json={"brave_api_key": "fake-key"})

    response = client.get("/api/v1/nutrition/recipes/search", params={"query": "soup"})
    assert response.status_code == 429
    assert "limited to" in response.json()["detail"]
