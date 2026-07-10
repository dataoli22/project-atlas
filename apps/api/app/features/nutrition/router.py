from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.features.nutrition.data_sources import (
    NutritionDataSourceError,
    NutritionProduct,
    get_default_nutrition_data_source_service,
)
from app.features.nutrition.schemas import (
    NutritionCookingPlanResponse,
    NutritionNutrientFactsResponse,
    NutritionPantryAddRequest,
    NutritionPantryResponse,
    NutritionPlannerResponse,
    NutritionProductLookupResponse,
    NutritionProductSearchResponse,
    NutritionProductSummary,
    NutritionShoppingListResponse,
    NutritionSubstitutionsResponse,
)
from app.features.nutrition.service import (
    get_nutrition_cooking_plan,
    get_nutrition_planner,
    get_nutrition_shopping_list,
    get_nutrition_substitutions,
    refresh_nutrition_planner,
)
from app.features.shared.schemas.health import BodyWeightMetric, HydrationMetric
from app.features.shared.services.state import shared_state

router = APIRouter()


class NutritionStatus(BaseModel):
    feature: str = "nutrition"
    status: str = "placeholder"
    shared_contracts: dict[str, dict[str, str]]


@router.get("", response_model=NutritionStatus)
def read_nutrition_placeholder() -> NutritionStatus:
    return NutritionStatus(
        shared_contracts={
            "hydration": HydrationMetric(amount=2000, unit="ml").model_dump(),
            "body_weight": BodyWeightMetric(value=70, unit="kg").model_dump(),
        }
    )


class NutritionPlannerRefreshRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=200)


@router.get("/planner", response_model=NutritionPlannerResponse)
def read_nutrition_planner() -> NutritionPlannerResponse:
    return get_nutrition_planner()


@router.post("/planner/refresh", response_model=NutritionPlannerResponse)
def refresh_nutrition_plan(
    payload: NutritionPlannerRefreshRequest | None = None,
) -> NutritionPlannerResponse:
    reason = payload.reason if payload else None
    return refresh_nutrition_planner(reason)


@router.get("/shopping-list", response_model=NutritionShoppingListResponse)
def read_nutrition_shopping_list() -> NutritionShoppingListResponse:
    return get_nutrition_shopping_list()


@router.get("/pantry", response_model=NutritionPantryResponse)
def read_pantry_items() -> NutritionPantryResponse:
    return NutritionPantryResponse(items=shared_state.get_pantry_items())


@router.post("/pantry", response_model=NutritionPantryResponse)
def add_pantry_item(payload: NutritionPantryAddRequest) -> NutritionPantryResponse:
    try:
        items = shared_state.add_pantry_item(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return NutritionPantryResponse(items=items)


@router.delete("/pantry/{name}", response_model=NutritionPantryResponse)
def remove_pantry_item(name: str) -> NutritionPantryResponse:
    return NutritionPantryResponse(items=shared_state.remove_pantry_item(name))


@router.get("/substitutions", response_model=NutritionSubstitutionsResponse)
def read_nutrition_substitutions() -> NutritionSubstitutionsResponse:
    return get_nutrition_substitutions()


@router.get("/cooking-plan", response_model=NutritionCookingPlanResponse)
def read_nutrition_cooking_plan() -> NutritionCookingPlanResponse:
    return get_nutrition_cooking_plan()


@router.get("/products/search", response_model=NutritionProductSearchResponse)
def search_nutrition_products(
    query: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=10, ge=1, le=25),
) -> NutritionProductSearchResponse:
    service = get_default_nutrition_data_source_service(brave_api_key=shared_state.get_brave_api_key())
    market_code = shared_state.get_localization().market
    try:
        outcome = service.search_products(query, market_code=market_code, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except NutritionDataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return NutritionProductSearchResponse(
        generated_at="2026-07-09T10:30:00Z",
        query=outcome.query,
        market_code=outcome.market_code,
        primary_source=outcome.primary_source,
        fallback_used=outcome.fallback_used,
        primary_error=outcome.primary_error,
        total_results=len(outcome.results),
        results=[_product_response(product) for product in outcome.results],
    )


@router.get("/products/barcode/{barcode}", response_model=NutritionProductLookupResponse)
def lookup_nutrition_product_by_barcode(barcode: str) -> NutritionProductLookupResponse:
    service = get_default_nutrition_data_source_service(brave_api_key=shared_state.get_brave_api_key())
    try:
        product = service.get_product_by_barcode(barcode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except NutritionDataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return NutritionProductLookupResponse(
        generated_at="2026-07-09T10:30:00Z",
        barcode=barcode,
        found=product is not None,
        product=_product_response(product) if product is not None else None,
    )


def _product_response(product: NutritionProduct) -> NutritionProductSummary:
    return NutritionProductSummary(
        name=product.name,
        source=product.source,
        source_id=product.source_id,
        brand=product.brand,
        barcode=product.barcode,
        serving_size=product.serving_size,
        categories=product.categories,
        image_url=product.image_url,
        nutriments=NutritionNutrientFactsResponse(
            calories_kcal_per_100g=product.nutriments.calories_kcal_per_100g,
            protein_grams_per_100g=product.nutriments.protein_grams_per_100g,
            carbohydrates_grams_per_100g=product.nutriments.carbohydrates_grams_per_100g,
            fat_grams_per_100g=product.nutriments.fat_grams_per_100g,
            fiber_grams_per_100g=product.nutriments.fiber_grams_per_100g,
            sugars_grams_per_100g=product.nutriments.sugars_grams_per_100g,
            sodium_mg_per_100g=product.nutriments.sodium_mg_per_100g,
        ),
        confidence=product.confidence,
        external_url=product.external_url,
    )
