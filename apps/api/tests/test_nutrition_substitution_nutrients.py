from app.features.nutrition.data_sources import (
    NutritionDataSourceError,
    NutritionNutrientFacts,
    NutritionProduct,
)
from app.features.nutrition.service import (
    _lookup_food_product,
    _nutrient_summary,
    _real_nutrient_comparison,
)


def _product(name: str, *, calories=None, protein=None) -> NutritionProduct:
    return NutritionProduct(
        name=name,
        source="open_food_facts",
        source_id=name,
        nutriments=NutritionNutrientFacts(
            calories_kcal_per_100g=calories, protein_grams_per_100g=protein
        ),
    )


def test_nutrient_summary_includes_both_calories_and_protein():
    product = _product("Chicken breast", calories=165, protein=31)

    assert _nutrient_summary(product) == "165kcal / 31g protein"


def test_nutrient_summary_handles_partial_data():
    product = _product("Mystery item", calories=200, protein=None)

    assert _nutrient_summary(product) == "200kcal"


def test_nutrient_summary_is_none_with_no_data():
    product = _product("Empty item")

    assert _nutrient_summary(product) is None


def test_real_nutrient_comparison_formats_both_sides(monkeypatch):
    from app.features.nutrition import service

    def fake_lookup(name):
        if name == "unit-test-chicken-breast-1":
            return _product(name, calories=165, protein=31)
        if name == "unit-test-dal-1":
            return _product(name, calories=116, protein=9)
        return None

    monkeypatch.setattr(service, "_lookup_food_product", fake_lookup)

    result = service._real_nutrient_comparison(
        ingredient="unit-test-chicken-breast-1", substitute="unit-test-dal-1"
    )

    assert result == (
        "unit-test-chicken-breast-1: 165kcal / 31g protein per 100g -> "
        "unit-test-dal-1: 116kcal / 9g protein per 100g (OpenFoodFacts)"
    )


def test_real_nutrient_comparison_is_none_when_a_side_is_not_found(monkeypatch):
    from app.features.nutrition import service

    monkeypatch.setattr(service, "_lookup_food_product", lambda name: None)

    result = service._real_nutrient_comparison(ingredient="unit-test-unknown-2", substitute="unit-test-unknown-3")

    assert result is None


def test_lookup_food_product_caches_repeated_calls(monkeypatch):
    from app.features.nutrition import service

    service._food_product_cache.clear()
    calls = {"count": 0}

    class FakeDataSource:
        def search_products(self, query, *, market_code, limit):
            calls["count"] += 1
            return [_product(query, calories=100, protein=5)]

    monkeypatch.setattr(service, "OpenFoodFactsDataSource", FakeDataSource)

    _lookup_food_product("unit-test-cached-item")
    _lookup_food_product("unit-test-cached-item")

    assert calls["count"] == 1
    service._food_product_cache.clear()


def test_lookup_food_product_returns_none_on_data_source_error(monkeypatch):
    from app.features.nutrition import service

    service._food_product_cache.clear()

    class FailingDataSource:
        def search_products(self, query, *, market_code, limit):
            raise NutritionDataSourceError("boom")

    monkeypatch.setattr(service, "OpenFoodFactsDataSource", FailingDataSource)

    assert _lookup_food_product("unit-test-failing-item") is None
    service._food_product_cache.clear()


def test_lookup_food_product_does_not_permanently_cache_a_transient_failure(monkeypatch):
    """The real bug this guards against: a plain @lru_cache would remember a transient 503 (or
    a momentary network blip) forever for the life of the process, permanently hiding a
    comparison that would have worked on retry a moment later.
    """
    from app.features.nutrition import service

    service._food_product_cache.clear()
    attempt = {"count": 0}

    class FlakyThenWorkingDataSource:
        def search_products(self, query, *, market_code, limit):
            attempt["count"] += 1
            if attempt["count"] == 1:
                raise NutritionDataSourceError("503 Service Temporarily Unavailable")
            return [_product(query, calories=50, protein=2)]

    monkeypatch.setattr(service, "OpenFoodFactsDataSource", FlakyThenWorkingDataSource)

    first = _lookup_food_product("unit-test-flaky-item")
    second = _lookup_food_product("unit-test-flaky-item")

    assert first is None
    assert second is not None
    assert attempt["count"] == 2  # retried, not served a cached None
    service._food_product_cache.clear()
