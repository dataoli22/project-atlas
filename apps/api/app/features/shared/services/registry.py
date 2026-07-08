from app.core.config import build_feature_registry, build_market_registry, get_settings
from app.features.shared.schemas.app import (
    AISettings,
    AppPreferences,
    FeatureRegistryResponse,
    FeatureSummary,
    LocalizationSettings,
    MarketOption,
    ProfileSettings,
)
from app.features.shared.services.ai import build_ai_settings_response
from app.features.shared.schemas.health import BodyWeightMetric, HydrationMetric


def get_enabled_feature_keys() -> list[str]:
    settings = get_settings()
    return [feature.key for feature in build_feature_registry(settings) if feature.enabled]


def get_feature_registry() -> FeatureRegistryResponse:
    settings = get_settings()
    features = [
        FeatureSummary(**feature.model_dump())
        for feature in build_feature_registry(settings)
        if feature.enabled
    ]
    return FeatureRegistryResponse(
        active_feature=settings.default_active_feature,
        features=features,
    )


def get_default_preferences() -> AppPreferences:
    settings = get_settings()
    enabled = get_enabled_feature_keys()
    return AppPreferences(
        active_feature=(
            settings.default_active_feature
            if settings.default_active_feature in enabled
            else enabled[0]
        ),
        enabled_feature_flags=enabled,
        preferred_platform_density="comfortable",
        shared_locale=f"{settings.default_language}-{settings.default_market}",
    )


def get_default_profile() -> ProfileSettings:
    return ProfileSettings(
        primary_goal="Build durable health routines",
        profile_type="general",
        activity_level="moderate",
        hydration=HydrationMetric(amount=2500, unit="ml", source="shared-default"),
        body_weight=BodyWeightMetric(value=70, unit="kg", source="shared-default"),
    )


def get_default_localization() -> LocalizationSettings:
    settings = get_settings()
    market = next(
        market for market in build_market_registry() if market.code == settings.default_market
    )
    return LocalizationSettings(
        market=market.code,
        currency=settings.default_currency,
        language=settings.default_language,
        locale=f"{settings.default_language}-{settings.default_market}",
        supported_languages=market.supported_languages,
    )


def get_markets() -> list[MarketOption]:
    return [MarketOption(**market.model_dump()) for market in build_market_registry()]


def get_default_ai_settings() -> AISettings:
    settings = get_settings()
    return build_ai_settings_response(
        default_provider="ollama",
        local_only_mode=settings.local_only_mode,
        self_hosted_distribution=True,
        allow_groq=False,
        ollama_base_url=settings.ollama_base_url,
        ollama_model=settings.ollama_model,
        ollama_embed_model=settings.ollama_embed_model,
        ollama_api_key_set=bool(settings.ollama_api_key),
        groq_model=settings.groq_model,
        groq_api_key_set=bool(settings.groq_api_key),
        system_prompt_style="token-lean",
        guardrail_level="strict",
        max_context_items=6,
        max_context_tokens=2400,
        response_token_budget=450,
    )
