from __future__ import annotations

from dataclasses import dataclass, field
import json
from json import JSONDecodeError
from typing import Any, Mapping, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


MAX_SEARCH_LIMIT = 25
DEFAULT_SEARCH_LIMIT = 10
DEFAULT_TIMEOUT_SECONDS = 3.0


class NutritionDataSourceError(RuntimeError):
    """Raised when a nutrition data source cannot return a usable response."""


@dataclass(frozen=True)
class NutritionNutrientFacts:
    calories_kcal_per_100g: float | None = None
    protein_grams_per_100g: float | None = None
    carbohydrates_grams_per_100g: float | None = None
    fat_grams_per_100g: float | None = None
    fiber_grams_per_100g: float | None = None
    sugars_grams_per_100g: float | None = None
    sodium_mg_per_100g: float | None = None


@dataclass(frozen=True)
class NutritionProduct:
    name: str
    source: str
    source_id: str
    brand: str | None = None
    barcode: str | None = None
    serving_size: str | None = None
    categories: list[str] = field(default_factory=list)
    image_url: str | None = None
    nutriments: NutritionNutrientFacts = field(default_factory=NutritionNutrientFacts)
    confidence: float = 0.5
    external_url: str | None = None


@dataclass(frozen=True)
class NutritionSearchHit:
    title: str
    url: str
    snippet: str = ""
    source_name: str = "search"
    metadata: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class NutritionDataSourceSearchOutcome:
    query: str
    market_code: str
    results: list[NutritionProduct]
    primary_source: str
    fallback_used: bool = False
    primary_error: str | None = None


class NutritionProductDataSource(Protocol):
    source_name: str

    def search_products(self, query: str, *, market_code: str, limit: int) -> Sequence[NutritionProduct]:
        ...

    def get_product_by_barcode(self, barcode: str) -> NutritionProduct | None:
        ...


class NutritionSearchFallbackProvider(Protocol):
    source_name: str

    def search(self, query: str, *, market_code: str, limit: int) -> Sequence[NutritionSearchHit]:
        ...


class NutritionProductScraper(Protocol):
    source_name: str

    def scrape_product(self, url: str, *, query: str, market_code: str) -> NutritionProduct | None:
        ...


class OpenFoodFactsDataSource:
    source_name = "open_food_facts"
    _DEFAULT_BASE_URL = "https://world.openfoodfacts.org"
    _PRODUCT_FIELDS = (
        "code",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
        "serving_size",
        "categories",
        "categories_tags",
        "image_front_url",
        "image_url",
        "nutriments",
        "url",
    )

    def __init__(
        self,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        opener: Any = urlopen,
        user_agent: str = "AtlasHealthAgent/0.1 (+https://openfoodfacts.org)",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._opener = opener
        self.user_agent = user_agent

    def search_products(self, query: str, *, market_code: str, limit: int) -> Sequence[NutritionProduct]:
        safe_query = _normalize_query(query)
        safe_limit = _bounded_limit(limit)
        params = {
            "search_terms": safe_query,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": str(safe_limit),
            "fields": ",".join(self._PRODUCT_FIELDS),
        }
        payload = self._request_json(f"{self.base_url}/cgi/search.pl?{urlencode(params)}")
        products = payload.get("products", [])
        if not isinstance(products, list):
            raise NutritionDataSourceError("Open Food Facts search returned an invalid products payload")
        return [
            product
            for product in (_product_from_open_food_facts(item) for item in products)
            if product is not None
        ][:safe_limit]

    def get_product_by_barcode(self, barcode: str) -> NutritionProduct | None:
        safe_barcode = _normalize_barcode(barcode)
        params = {"fields": ",".join(self._PRODUCT_FIELDS)}
        payload = self._request_json(f"{self.base_url}/api/v2/product/{safe_barcode}.json?{urlencode(params)}")
        if payload.get("status") != 1:
            return None
        product = payload.get("product")
        if not isinstance(product, Mapping):
            return None
        return _product_from_open_food_facts(product)

    def _request_json(self, url: str) -> Mapping[str, Any]:
        request = Request(url, headers={"User-Agent": self.user_agent, "Accept": "application/json"})
        try:
            with self._opener(request, timeout=self.timeout_seconds) as response:
                raw_body = response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise NutritionDataSourceError(f"Open Food Facts request failed: {exc}") from exc

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, JSONDecodeError) as exc:
            raise NutritionDataSourceError("Open Food Facts returned invalid JSON") from exc
        if not isinstance(payload, Mapping):
            raise NutritionDataSourceError("Open Food Facts returned a non-object JSON payload")
        return payload


class BraveSearchProvider:
    """Optional, opt-in NutritionSearchFallbackProvider backed by the Brave Search API.

    Only ever instantiated when the user has configured a Brave API key in Settings -> Search
    (see SearchSettings/get_default_nutrition_data_source_service) - the key is supplied by and
    stays entirely on this device, sent directly to Brave's API over HTTPS and nowhere else, same
    local-first guarantee as the Ollama/Groq provider keys. If no key is configured, this class
    is never constructed and OpenFoodFacts remains the only product data source.
    """

    source_name = "brave_search"
    _DEFAULT_BASE_URL = "https://api.search.brave.com/res/v1/web/search"

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = _DEFAULT_BASE_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        opener: Any = urlopen,
    ) -> None:
        if not api_key:
            raise ValueError("BraveSearchProvider requires a non-empty api_key.")
        self._api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._opener = opener

    def search(self, query: str, *, market_code: str, limit: int) -> Sequence[NutritionSearchHit]:
        safe_query = _normalize_query(query)
        safe_limit = _bounded_limit(limit)
        params = {"q": safe_query, "count": str(safe_limit)}
        request = Request(
            f"{self.base_url}?{urlencode(params)}",
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": self._api_key,
            },
        )
        try:
            with self._opener(request, timeout=self.timeout_seconds) as response:
                raw_body = response.read()
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise NutritionDataSourceError(f"Brave Search request failed: {exc}") from exc

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, JSONDecodeError) as exc:
            raise NutritionDataSourceError("Brave Search returned invalid JSON") from exc
        if not isinstance(payload, Mapping):
            raise NutritionDataSourceError("Brave Search returned a non-object JSON payload")

        results = payload.get("web", {})
        raw_hits = results.get("results", []) if isinstance(results, Mapping) else []
        if not isinstance(raw_hits, list):
            return []

        return [
            hit
            for hit in (_search_hit_from_brave(item) for item in raw_hits)
            if hit is not None
        ][:safe_limit]


class SearchScrapeFallbackDataSource:
    source_name = "search_scrape_fallback"

    def __init__(
        self,
        *,
        search_provider: NutritionSearchFallbackProvider,
        scraper: NutritionProductScraper | None = None,
    ) -> None:
        self.search_provider = search_provider
        self.scraper = scraper

    def search_products(self, query: str, *, market_code: str, limit: int) -> Sequence[NutritionProduct]:
        safe_query = _normalize_query(query)
        safe_limit = _bounded_limit(limit)
        hits = self.search_provider.search(safe_query, market_code=market_code, limit=safe_limit)
        products: list[NutritionProduct] = []
        for hit in hits[:safe_limit]:
            scraped = self._scrape_hit(hit, query=safe_query, market_code=market_code)
            products.append(scraped or _product_from_search_hit(hit))
        return products

    def get_product_by_barcode(self, barcode: str) -> NutritionProduct | None:
        _normalize_barcode(barcode)
        return None

    def _scrape_hit(self, hit: NutritionSearchHit, *, query: str, market_code: str) -> NutritionProduct | None:
        if self.scraper is None:
            return None
        try:
            return self.scraper.scrape_product(hit.url, query=query, market_code=market_code)
        except Exception:
            return None


class NutritionDataSourceService:
    def __init__(
        self,
        *,
        primary: NutritionProductDataSource | None = None,
        fallbacks: Sequence[NutritionProductDataSource] | None = None,
    ) -> None:
        self.primary = primary or OpenFoodFactsDataSource()
        self.fallbacks = list(fallbacks or [])

    def search_products(
        self,
        query: str,
        *,
        market_code: str,
        limit: int = DEFAULT_SEARCH_LIMIT,
    ) -> NutritionDataSourceSearchOutcome:
        safe_query = _normalize_query(query)
        safe_limit = _bounded_limit(limit)
        primary_error: str | None = None
        try:
            primary_results = list(
                self.primary.search_products(safe_query, market_code=market_code, limit=safe_limit)
            )
            if primary_results:
                return NutritionDataSourceSearchOutcome(
                    query=safe_query,
                    market_code=market_code,
                    results=primary_results[:safe_limit],
                    primary_source=self.primary.source_name,
                )
        except NutritionDataSourceError as exc:
            primary_error = str(exc)

        for fallback in self.fallbacks:
            try:
                fallback_results = list(
                    fallback.search_products(safe_query, market_code=market_code, limit=safe_limit)
                )
            except NutritionDataSourceError:
                continue
            if fallback_results:
                return NutritionDataSourceSearchOutcome(
                    query=safe_query,
                    market_code=market_code,
                    results=fallback_results[:safe_limit],
                    primary_source=self.primary.source_name,
                    fallback_used=True,
                    primary_error=primary_error,
                )

        return NutritionDataSourceSearchOutcome(
            query=safe_query,
            market_code=market_code,
            results=[],
            primary_source=self.primary.source_name,
            fallback_used=bool(self.fallbacks),
            primary_error=primary_error,
        )

    def get_product_by_barcode(self, barcode: str) -> NutritionProduct | None:
        return self.primary.get_product_by_barcode(_normalize_barcode(barcode))


def get_default_nutrition_data_source_service(
    *, brave_api_key: str = ""
) -> NutritionDataSourceService:
    """OpenFoodFacts is always the primary source. The Brave-backed search fallback is only
    registered when a key is actually configured - with no key, this behaves exactly as before
    (OpenFoodFacts only, no fallback), so the opt-in stays genuinely opt-in rather than silently
    depending on an unconfigured external service."""
    fallbacks: list[NutritionProductDataSource] = []
    if brave_api_key:
        fallbacks.append(
            SearchScrapeFallbackDataSource(search_provider=BraveSearchProvider(api_key=brave_api_key))
        )
    return NutritionDataSourceService(fallbacks=fallbacks)


def _search_hit_from_brave(raw_hit: Any) -> NutritionSearchHit | None:
    if not isinstance(raw_hit, Mapping):
        return None
    title = _first_text(raw_hit.get("title"))
    url = _first_text(raw_hit.get("url"))
    if title is None or url is None:
        return None
    return NutritionSearchHit(
        title=title,
        url=url,
        snippet=_first_text(raw_hit.get("description")) or "",
        source_name=BraveSearchProvider.source_name,
    )


def _product_from_open_food_facts(raw_product: Any) -> NutritionProduct | None:
    if not isinstance(raw_product, Mapping):
        return None
    name = _first_text(
        raw_product.get("product_name_en"),
        raw_product.get("product_name"),
        raw_product.get("generic_name"),
    )
    if name is None:
        return None
    barcode = _first_text(raw_product.get("code"))
    return NutritionProduct(
        name=name,
        source=OpenFoodFactsDataSource.source_name,
        source_id=barcode or name,
        brand=_first_text(raw_product.get("brands")),
        barcode=barcode,
        serving_size=_first_text(raw_product.get("serving_size")),
        categories=_categories_from_open_food_facts(raw_product),
        image_url=_first_text(raw_product.get("image_front_url"), raw_product.get("image_url")),
        nutriments=_nutrients_from_open_food_facts(raw_product.get("nutriments")),
        confidence=0.95,
        external_url=_first_text(raw_product.get("url")),
    )


def _product_from_search_hit(hit: NutritionSearchHit) -> NutritionProduct:
    source = hit.source_name or "search"
    return NutritionProduct(
        name=hit.title.strip(),
        source=source,
        source_id=hit.url,
        categories=[],
        confidence=0.45,
        external_url=hit.url,
    )


def _nutrients_from_open_food_facts(raw_nutriments: Any) -> NutritionNutrientFacts:
    if not isinstance(raw_nutriments, Mapping):
        return NutritionNutrientFacts()
    sodium_grams = _first_number(raw_nutriments, "sodium_100g", "sodium")
    return NutritionNutrientFacts(
        calories_kcal_per_100g=_first_number(
            raw_nutriments,
            "energy-kcal_100g",
            "energy-kcal_serving",
            "energy-kcal",
        ),
        protein_grams_per_100g=_first_number(raw_nutriments, "proteins_100g", "proteins"),
        carbohydrates_grams_per_100g=_first_number(raw_nutriments, "carbohydrates_100g", "carbohydrates"),
        fat_grams_per_100g=_first_number(raw_nutriments, "fat_100g", "fat"),
        fiber_grams_per_100g=_first_number(raw_nutriments, "fiber_100g", "fiber"),
        sugars_grams_per_100g=_first_number(raw_nutriments, "sugars_100g", "sugars"),
        sodium_mg_per_100g=sodium_grams * 1000 if sodium_grams is not None else None,
    )


def _categories_from_open_food_facts(raw_product: Mapping[str, Any]) -> list[str]:
    raw_tags = raw_product.get("categories_tags")
    if isinstance(raw_tags, list):
        values = [_format_category_tag(item) for item in raw_tags if isinstance(item, str)]
        return [value for value in values if value]
    raw_categories = raw_product.get("categories")
    if isinstance(raw_categories, str):
        return [category.strip() for category in raw_categories.split(",") if category.strip()]
    return []


def _format_category_tag(tag: str) -> str:
    tag_without_locale = tag.split(":", 1)[-1]
    return tag_without_locale.replace("-", " ").strip().title()


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _first_number(values: Mapping[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = values.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue
    return None


def _normalize_query(query: str) -> str:
    normalized = " ".join(query.strip().split())
    if not normalized:
        raise ValueError("Nutrition product search query cannot be blank")
    return normalized[:120]


def _normalize_barcode(barcode: str) -> str:
    normalized = barcode.strip()
    if not normalized.isdigit() or not 8 <= len(normalized) <= 14:
        raise ValueError("Nutrition product barcode must contain 8 to 14 digits")
    return normalized


def _bounded_limit(limit: int) -> int:
    return max(1, min(int(limit), MAX_SEARCH_LIMIT))
