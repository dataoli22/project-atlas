from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.features.nutrition.data_sources import NutritionDataSourceService, NutritionProduct
from app.features.shared.schemas.app import AISettings

if TYPE_CHECKING:
    from app.features.shared.services.chat import ProviderAttempt

_INGREDIENT_COUNT_RANGE = (4, 7)
_RESPONSE_TOKEN_BUDGET = 200

_SYSTEM_PROMPT = (
    "You list the concise, real-world ingredient names for a home-cooked dish. Respond with "
    "ONLY a JSON array of short ingredient name strings (4 to 7 items, e.g. [\"chicken breast\", "
    "\"basmati rice\", \"yogurt\", \"garam masala\"]) - no other text, no explanation, no markdown "
    "fences."
)


@dataclass(frozen=True)
class GeneratedIngredient:
    name: str
    category: str | None
    matched_product_name: str | None
    matched_product_source: str | None
    confidence: float

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "category": self.category,
            "matched_product_name": self.matched_product_name,
            "matched_product_source": self.matched_product_source,
            "confidence": self.confidence,
        }


def generate_meal_ingredients(
    *,
    dish_name: str,
    market_code: str,
    ai_settings: AISettings,
    ollama_api_key: str,
    groq_api_key: str,
    data_source_service: NutritionDataSourceService,
) -> list[dict]:
    """Builds a real ingredient list for a dish: the AI proposes plausible ingredient names, then
    each name is grounded against a real Open Food Facts product via `data_source_service`
    (retrieval), rather than trusting the AI's raw output as fact. This is the RAG step that lets
    shopping-list/cooking-plan generation (nutrition/service.py) derive from real per-meal data
    instead of the old hand-authored per-market shopping_items/cooking_steps.

    Degrades gracefully rather than blocking a meal swap: if every AI provider is unavailable,
    returns a single ungrounded entry using the dish name itself, clearly distinguishable via
    confidence=0.0 and matched_product_source=None - not a fabricated ingredient breakdown.
    """
    candidate_names = _propose_ingredient_names(
        dish_name=dish_name,
        ai_settings=ai_settings,
        ollama_api_key=ollama_api_key,
        groq_api_key=groq_api_key,
    )
    if not candidate_names:
        return [
            GeneratedIngredient(
                name=dish_name,
                category=None,
                matched_product_name=None,
                matched_product_source=None,
                confidence=0.0,
            ).to_dict()
        ]

    ingredients = [
        _ground_ingredient(name, market_code=market_code, data_source_service=data_source_service)
        for name in candidate_names
    ]
    return [ingredient.to_dict() for ingredient in ingredients]


def _propose_ingredient_names(
    *,
    dish_name: str,
    ai_settings: AISettings,
    ollama_api_key: str,
    groq_api_key: str,
) -> list[str]:
    # Deferred import - see the TYPE_CHECKING import above for why this can't be a module-level
    # import (chat.py -> agent_runtime.py -> nutrition/service.py -> this module would cycle).
    from app.features.shared.services.chat import build_provider_attempts

    attempts = build_provider_attempts(
        plan_provider=ai_settings.default_provider,
        plan_model=ai_settings.groq_model if ai_settings.default_provider == "groq" else ai_settings.ollama_model,
        ai_settings=ai_settings,
        ollama_api_key=ollama_api_key,
        groq_api_key=groq_api_key,
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"Dish: {dish_name}"},
    ]

    for attempt in attempts:
        names = _try_attempt(attempt, messages)
        if names:
            return names
    return []


def _try_attempt(attempt: ProviderAttempt, messages: list[dict[str, str]]) -> list[str]:
    try:
        result = attempt.client.complete(
            model=attempt.model,
            messages=messages,
            response_token_budget=_RESPONSE_TOKEN_BUDGET,
        )
    except Exception:
        return []
    return _parse_ingredient_names(result.answer)


def _parse_ingredient_names(raw_answer: str) -> list[str]:
    # Models sometimes wrap JSON in markdown fences despite instructions - strip those before
    # parsing rather than failing the whole generation over formatting.
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_answer.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    names = [item.strip() for item in parsed if isinstance(item, str) and item.strip()]
    min_count, max_count = _INGREDIENT_COUNT_RANGE
    return names[:max_count] if len(names) >= min_count else names


def _ground_ingredient(
    name: str, *, market_code: str, data_source_service: NutritionDataSourceService
) -> GeneratedIngredient:
    try:
        outcome = data_source_service.search_products(name, market_code=market_code, limit=1)
    except Exception:
        outcome = None

    match: NutritionProduct | None = outcome.results[0] if outcome and outcome.results else None
    if match is None:
        return GeneratedIngredient(
            name=name,
            category=None,
            matched_product_name=None,
            matched_product_source=None,
            confidence=0.0,
        )
    return GeneratedIngredient(
        name=name,
        category=match.categories[0] if match.categories else None,
        matched_product_name=match.name,
        matched_product_source=match.source,
        confidence=match.confidence,
    )
