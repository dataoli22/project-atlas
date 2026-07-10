from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


FeatureKey = Literal["endurance", "nutrition"]
MarketCode = Literal["EU", "CN", "IN", "UK", "US"]
LanguageCode = Literal["en", "fr", "de", "zh"]
CurrencyCode = Literal["EUR", "CNY", "INR", "GBP", "USD"]


class FeatureDefinition(BaseModel):
    key: FeatureKey
    label: str
    description: str
    enabled: bool = True


class MarketDefinition(BaseModel):
    code: MarketCode
    name: str
    default_currency: CurrencyCode
    default_language: LanguageCode
    supported_languages: list[LanguageCode]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ATLAS_",
        extra="ignore",
    )

    app_name: str = "Project Atlas API"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    default_active_feature: FeatureKey = "endurance"

    # The actual bind host/port are set on the uvicorn command line (see
    # desktop/electron/main.js), not read from here directly - these exist so the running
    # process can report its own port back in pairing.info responses (see
    # app/features/shared/services/pairing.py) without main.js having to inject it separately.
    # api_host defaults to loopback-only; LAN pairing requires launching with
    # ATLAS_API_HOST=0.0.0.0 explicitly - see docs/packaging-and-installation.md.
    api_host: str = "127.0.0.1"
    api_port: int = 8000

    feature_endurance_enabled: bool = True
    feature_nutrition_enabled: bool = True

    default_market: MarketCode = "IN"
    default_currency: CurrencyCode = "INR"
    default_language: LanguageCode = "en"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    groq_api_key: str = ""
    # Optional, opt-in: powers the nutrition browser-search fallback (data_sources.py's
    # SearchScrapeFallbackDataSource) when OpenFoodFacts alone doesn't have a product. Same
    # local-first guarantee as the AI provider keys above - sent directly from this device to
    # Brave's API, never through an Atlas-hosted relay. Empty by default; the fallback provider
    # is simply never registered if this is unset.
    brave_api_key: str = ""
    # Cloud providers (Groq free tier, or Ollama pointed at a cloud/hosted endpoint with an API
    # key) are preferred by default once configured, with on-device Ollama as an automatic
    # resilience fallback - see chat.py's provider attempt chain. Provider keys and prompts are
    # still never routed through an Atlas-hosted relay: calls go directly from this device to
    # the provider. Users who want a hard guarantee that nothing ever leaves the device can still
    # enable local_only_mode, which forces Ollama and blocks Groq.
    local_only_mode: bool = False
    strava_client_id: str = ""
    strava_client_secret: str = ""
    strava_redirect_uri: str = "http://localhost:8000/api/v1/integrations/strava/callback"
    strava_scopes: str = "read,activity:read_all"
    local_state_path: str = "apps/api/.local/shared-state.json"
    local_db_path: str = "apps/api/.local/atlas.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def build_feature_registry(settings: Settings) -> list[FeatureDefinition]:
    return [
        FeatureDefinition(
            key="endurance",
            label="Endurance and Capability",
            description="Training, recovery, capability, and performance workflows.",
            enabled=settings.feature_endurance_enabled,
        ),
        FeatureDefinition(
            key="nutrition",
            label="Nutrition and Meal Planning",
            description="Nutrition targets, meal planning, shopping, and cooking workflows.",
            enabled=settings.feature_nutrition_enabled,
        ),
    ]


def build_market_registry() -> list[MarketDefinition]:
    return [
        MarketDefinition(
            code="EU",
            name="Europe",
            default_currency="EUR",
            default_language="en",
            supported_languages=["en", "fr", "de"],
        ),
        MarketDefinition(
            code="CN",
            name="China",
            default_currency="CNY",
            default_language="zh",
            supported_languages=["zh"],
        ),
        MarketDefinition(
            code="IN",
            name="India",
            default_currency="INR",
            default_language="en",
            supported_languages=["en"],
        ),
        MarketDefinition(
            code="UK",
            name="United Kingdom",
            default_currency="GBP",
            default_language="en",
            supported_languages=["en"],
        ),
        MarketDefinition(
            code="US",
            name="United States",
            default_currency="USD",
            default_language="en",
            supported_languages=["en"],
        ),
    ]
