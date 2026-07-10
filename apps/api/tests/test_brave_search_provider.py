import json

import pytest

from app.features.nutrition.data_sources import (
    BraveSearchProvider,
    NutritionDataSourceError,
    get_default_nutrition_data_source_service,
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


def test_brave_search_sends_the_api_key_as_a_header_not_a_query_param():
    captured = {}

    def fake_opener(request, timeout):
        captured["headers"] = dict(request.headers)
        captured["url"] = request.full_url
        return FakeHttpResponse({"web": {"results": []}})

    provider = BraveSearchProvider(api_key="secret-brave-key", opener=fake_opener)
    provider.search("chana dal", market_code="IN", limit=5)

    assert captured["headers"].get("X-subscription-token") == "secret-brave-key"
    assert "secret-brave-key" not in captured["url"]


def test_brave_search_maps_web_results_to_search_hits():
    def fake_opener(request, timeout):
        return FakeHttpResponse(
            {
                "web": {
                    "results": [
                        {
                            "title": "Chana Dal Nutrition Facts",
                            "url": "https://example.com/chana-dal",
                            "description": "Protein and fiber content per 100g.",
                        }
                    ]
                }
            }
        )

    provider = BraveSearchProvider(api_key="key", opener=fake_opener)
    hits = provider.search("chana dal", market_code="IN", limit=5)

    assert len(hits) == 1
    assert hits[0].title == "Chana Dal Nutrition Facts"
    assert hits[0].url == "https://example.com/chana-dal"
    assert hits[0].source_name == "brave_search"


def test_brave_search_rejects_empty_api_key():
    with pytest.raises(ValueError):
        BraveSearchProvider(api_key="")


def test_brave_search_wraps_transport_failures():
    def failing_opener(request, timeout):
        raise OSError("network down")

    provider = BraveSearchProvider(api_key="key", opener=failing_opener)

    with pytest.raises(NutritionDataSourceError):
        provider.search("chana dal", market_code="IN", limit=5)


def test_default_service_has_no_fallback_without_a_brave_key():
    service = get_default_nutrition_data_source_service(brave_api_key="")

    assert service.fallbacks == []


def test_default_service_registers_brave_fallback_when_key_is_configured():
    service = get_default_nutrition_data_source_service(brave_api_key="configured-key")

    assert len(service.fallbacks) == 1
    assert service.fallbacks[0].source_name == "search_scrape_fallback"
