import json

from app.features.nutrition.data_sources import (
    NutritionDataSourceService,
    NutritionProduct,
    NutritionSearchHit,
    OpenFoodFactsDataSource,
    SearchScrapeFallbackDataSource,
)


class FakeHttpResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_open_food_facts_search_maps_api_products_without_browser_dependencies():
    captured = {}

    def fake_opener(request, timeout):
        captured["url"] = request.full_url
        captured["user_agent"] = request.headers["User-agent"]
        captured["timeout"] = timeout
        return FakeHttpResponse(
            {
                "products": [
                    {
                        "code": "1234567890123",
                        "product_name": "Rolled Oats",
                        "brands": "Atlas Pantry",
                        "serving_size": "40 g",
                        "categories_tags": ["en:breakfast-cereals", "en:oatmeal"],
                        "image_front_url": "https://example.test/oats.jpg",
                        "nutriments": {
                            "energy-kcal_100g": 389,
                            "proteins_100g": "16.9",
                            "carbohydrates_100g": 66.3,
                            "fat_100g": 6.9,
                            "fiber_100g": 10.6,
                            "sugars_100g": 0.9,
                            "sodium_100g": 0.002,
                        },
                        "url": "https://world.openfoodfacts.org/product/1234567890123",
                    }
                ]
            }
        )

    source = OpenFoodFactsDataSource(opener=fake_opener)

    products = list(source.search_products("  rolled   oats  ", market_code="US", limit=50))

    assert len(products) == 1
    assert "world.openfoodfacts.org/cgi/search.pl" in captured["url"]
    assert "page_size=25" in captured["url"]
    assert "search_terms=rolled+oats" in captured["url"]
    assert captured["user_agent"].startswith("AtlasHealthAgent/")
    assert captured["timeout"] == 3.0
    assert products[0].name == "Rolled Oats"
    assert products[0].source == "open_food_facts"
    assert products[0].barcode == "1234567890123"
    assert products[0].categories == ["Breakfast Cereals", "Oatmeal"]
    assert products[0].nutriments.protein_grams_per_100g == 16.9
    assert products[0].nutriments.sodium_mg_per_100g == 2.0


def test_open_food_facts_barcode_lookup_returns_none_for_missing_product():
    def fake_opener(request, timeout):
        return FakeHttpResponse({"status": 0})

    source = OpenFoodFactsDataSource(opener=fake_opener)

    assert source.get_product_by_barcode("12345678") is None


def test_data_source_service_uses_search_scrape_fallback_when_primary_is_empty():
    class EmptyPrimary:
        source_name = "empty_primary"

        def search_products(self, query, *, market_code, limit):
            return []

        def get_product_by_barcode(self, barcode):
            return None

    class FakeSearchProvider:
        source_name = "test_search"

        def search(self, query, *, market_code, limit):
            return [
                NutritionSearchHit(
                    title="Fallback oats product",
                    url="https://example.test/fallback-oats",
                    source_name=self.source_name,
                )
            ]

    class FakeScraper:
        source_name = "test_scraper"

        def scrape_product(self, url, *, query, market_code):
            return NutritionProduct(
                name="Scraped oats",
                source=self.source_name,
                source_id=url,
                brand="Fallback Brand",
                confidence=0.7,
                external_url=url,
            )

    fallback = SearchScrapeFallbackDataSource(
        search_provider=FakeSearchProvider(),
        scraper=FakeScraper(),
    )
    service = NutritionDataSourceService(primary=EmptyPrimary(), fallbacks=[fallback])

    outcome = service.search_products("oats", market_code="IN", limit=5)

    assert outcome.primary_source == "empty_primary"
    assert outcome.fallback_used is True
    assert outcome.results[0].name == "Scraped oats"
    assert outcome.results[0].source == "test_scraper"


def test_data_source_service_bounds_fallback_limit_and_rejects_blank_query():
    class EmptyPrimary:
        source_name = "empty_primary"

        def search_products(self, query, *, market_code, limit):
            return []

        def get_product_by_barcode(self, barcode):
            return None

    class CapturingSearchProvider:
        source_name = "capturing_search"

        def __init__(self):
            self.limit = None

        def search(self, query, *, market_code, limit):
            self.limit = limit
            return [
                NutritionSearchHit(
                    title=f"Result {index}",
                    url=f"https://example.test/{index}",
                    source_name=self.source_name,
                )
                for index in range(limit)
            ]

    search_provider = CapturingSearchProvider()
    service = NutritionDataSourceService(
        primary=EmptyPrimary(),
        fallbacks=[SearchScrapeFallbackDataSource(search_provider=search_provider)],
    )

    outcome = service.search_products("oats", market_code="US", limit=99)

    assert search_provider.limit == 25
    assert len(outcome.results) == 25

    try:
        service.search_products("   ", market_code="US")
    except ValueError as exc:
        assert "cannot be blank" in str(exc)
    else:
        raise AssertionError("Expected blank nutrition queries to be rejected")


def test_nutrition_product_search_endpoint_uses_injected_data_source(client, monkeypatch):
    class FakeService:
        def search_products(self, query, *, market_code, limit):
            return type(
                "Outcome",
                (),
                {
                    "query": query,
                    "market_code": market_code,
                    "primary_source": "fake_primary",
                    "fallback_used": False,
                    "primary_error": None,
                    "results": [
                        NutritionProduct(
                            name="Endpoint oats",
                            source="fake_primary",
                            source_id="endpoint-oats",
                            barcode="12345678",
                            confidence=0.9,
                        )
                    ],
                },
            )()

    monkeypatch.setattr(
        "app.features.nutrition.router.get_default_nutrition_data_source_service",
        lambda **kwargs: FakeService(),
    )

    response = client.get("/api/v1/nutrition/products/search", params={"query": "oats", "limit": 3})

    assert response.status_code == 200
    payload = response.json()
    assert payload["active_feature"] == "nutrition"
    assert payload["market_code"] == "IN"
    assert payload["primary_source"] == "fake_primary"
    assert payload["total_results"] == 1
    assert payload["results"][0]["name"] == "Endpoint oats"
