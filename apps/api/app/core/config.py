from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


FeatureKey = Literal["endurance", "nutrition"]
MarketCode = Literal["EU", "CN", "IN", "JP", "UK", "US"]
LanguageCode = Literal["en", "fr", "de", "zh", "ja"]
CurrencyCode = Literal["EUR", "CNY", "INR", "JPY", "GBP", "USD"]
CuisineType = Literal["indian", "japanese", "chinese", "continental"]


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
    app_version: str = "0.1.4"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    # Nutrition is the higher-usage module day to day, so it's the default landing feature
    # (matches the frontend nav/feature-switcher ordering in apps/web/lib/navigation.ts).
    default_active_feature: FeatureKey = "nutrition"

    # The actual bind host/port are set on the uvicorn command line (see
    # desktop/electron/main.js), not read from here directly - these exist so the running
    # process can report its own port back in pairing.info responses (see
    # app/features/shared/services/pairing.py) without main.js having to inject it separately.
    # api_host defaults to loopback-only; LAN pairing requires launching with
    # ATLAS_API_HOST=0.0.0.0 explicitly - see docs/build-and-run/packaging-and-installation.md.
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


def validate_startup_config(settings: Settings) -> None:
    """Fail fast with a clear message instead of a confusing downstream stack trace.

    Runs once at process startup (see `main.py`'s lifespan). The two local-first storage paths
    are the most likely thing to be wrong on a real machine - an OS permission change, a synced
    folder (OneDrive/Dropbox) locking a file, a path pointing at a removable drive that isn't
    mounted - and today those surface as an opaque `sqlite3.OperationalError` or `PermissionError`
    buried inside `SharedStateStore.__init__`, which already runs at import time before this
    function's caller even gets a chance to run. This performs the same directory-creation check
    explicitly, with an error message that names the actual setting to fix.
    """

    for label, raw_path, env_var in (
        ("local_db_path", settings.local_db_path, "ATLAS_LOCAL_DB_PATH"),
        ("local_state_path", settings.local_state_path, "ATLAS_LOCAL_STATE_PATH"),
    ):
        directory = Path(raw_path).parent
        try:
            directory.mkdir(parents=True, exist_ok=True)
            probe = directory / ".atlas_startup_write_check"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
        except OSError as exc:
            raise RuntimeError(
                f"Atlas cannot write to the directory for {label} ('{directory}'). "
                f"Set {env_var} to a writable location and restart Atlas. Original error: {exc}"
            ) from exc

    if not (1 <= settings.api_port <= 65535):
        raise RuntimeError(
            f"ATLAS_API_PORT is set to {settings.api_port}, which is not a valid TCP port (1-65535)."
        )


def build_feature_registry(settings: Settings) -> list[FeatureDefinition]:
    # Nutrition first - it's the higher-usage module day to day (matches the frontend nav
    # ordering in apps/web/lib/navigation.ts).
    return [
        FeatureDefinition(
            key="nutrition",
            label="Nutrition and Meal Planning",
            description="Nutrition targets, meal planning, shopping, and cooking workflows.",
            enabled=settings.feature_nutrition_enabled,
        ),
        FeatureDefinition(
            key="endurance",
            label="Endurance and Capability",
            description="Training, recovery, capability, and performance workflows.",
            enabled=settings.feature_endurance_enabled,
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
            code="JP",
            name="Japan",
            default_currency="JPY",
            default_language="ja",
            supported_languages=["ja", "en"],
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
