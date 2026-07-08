from typing import Literal

from pydantic import BaseModel, Field

from app.core.config import CurrencyCode, FeatureKey, LanguageCode, MarketCode
from app.features.shared.schemas.health import BodyWeightMetric, HydrationMetric


DensityMode = Literal["compact", "comfortable"]
AIProvider = Literal["ollama", "groq"]
PromptStyle = Literal["token-lean", "comprehensive-guarded"]
GuardrailLevel = Literal["strict", "maximum"]
IntegrationSourceKey = Literal["strava", "health_connect", "samsung_health"]
IntegrationConnectMode = Literal["oauth", "device-permission", "sdk-consent"]


class UserSummary(BaseModel):
    id: str
    email: str
    display_name: str


class HealthCheckResponse(BaseModel):
    status: str
    app_name: str
    version: str
    active_feature: FeatureKey
    enabled_features: list[FeatureKey]


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary


class FeatureSummary(BaseModel):
    key: FeatureKey
    label: str
    description: str
    enabled: bool


class AppPreferences(BaseModel):
    active_feature: FeatureKey
    enabled_feature_flags: list[FeatureKey]
    preferred_platform_density: DensityMode = "comfortable"
    shared_locale: str = "en-IN"


class AppPreferencesUpdate(BaseModel):
    active_feature: FeatureKey
    enabled_feature_flags: list[FeatureKey]
    preferred_platform_density: DensityMode = "comfortable"
    shared_locale: str = "en-IN"


class FeatureRegistryResponse(BaseModel):
    active_feature: FeatureKey
    features: list[FeatureSummary]


class ProfileSettings(BaseModel):
    primary_goal: str | None = None
    profile_type: str | None = None
    activity_level: str | None = None
    hydration: HydrationMetric | None = None
    body_weight: BodyWeightMetric | None = None


class ProfileSettingsUpdate(BaseModel):
    primary_goal: str | None = None
    profile_type: str | None = None
    activity_level: str | None = None
    hydration: HydrationMetric | None = None
    body_weight: BodyWeightMetric | None = None


class LocalizationSettings(BaseModel):
    market: MarketCode
    currency: CurrencyCode
    language: LanguageCode
    locale: str
    supported_languages: list[LanguageCode]
    currency_override: bool = False
    language_override: bool = False


class LocalizationSettingsUpdate(BaseModel):
    market: MarketCode
    currency: CurrencyCode
    language: LanguageCode
    locale: str
    currency_override: bool = False
    language_override: bool = False


class MarketOption(BaseModel):
    code: MarketCode
    name: str
    default_currency: CurrencyCode
    default_language: LanguageCode
    supported_languages: list[LanguageCode]


class AgentPromptProfile(BaseModel):
    module: Literal["shared", "endurance", "nutrition"]
    title: str
    system_prompt: str
    guardrail_rules: list[str]
    token_strategy_note: str
    max_context_tokens: int
    response_token_budget: int


class AISettings(BaseModel):
    default_provider: AIProvider = "ollama"
    local_only_mode: bool = True
    self_hosted_distribution: bool = True
    allow_groq: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_api_key_set: bool = False
    groq_model: str = "llama-3.1-8b-instant"
    groq_api_key_set: bool = False
    system_prompt_style: PromptStyle = "token-lean"
    guardrail_level: GuardrailLevel = "strict"
    max_context_items: int = Field(default=6, ge=1, le=24)
    max_context_tokens: int = Field(default=2400, ge=256, le=8192)
    response_token_budget: int = Field(default=450, ge=64, le=2048)
    device_notice: str
    prompt_profiles: list[AgentPromptProfile]


class AISettingsUpdate(BaseModel):
    default_provider: AIProvider = "ollama"
    local_only_mode: bool = True
    self_hosted_distribution: bool = True
    allow_groq: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_api_key: str | None = None
    clear_ollama_api_key: bool = False
    groq_model: str = "llama-3.1-8b-instant"
    groq_api_key: str | None = None
    clear_groq_api_key: bool = False
    system_prompt_style: PromptStyle = "token-lean"
    guardrail_level: GuardrailLevel = "strict"
    max_context_items: int = Field(default=6, ge=1, le=24)
    max_context_tokens: int = Field(default=2400, ge=256, le=8192)
    response_token_budget: int = Field(default=450, ge=64, le=2048)


class AIRuntimeHealthCheckRequest(BaseModel):
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_api_key: str | None = None


class AIRuntimeHealthCheckResponse(BaseModel):
    ok: bool
    target: str
    local_target: bool
    provider: Literal["ollama"] = "ollama"
    message: str
    version: str | None = None
    model_checked: str | None = None
    model_available: bool | None = None


class IntegrationSourceStatus(BaseModel):
    key: IntegrationSourceKey
    title: str
    connect_mode: IntegrationConnectMode
    connected: bool
    status: str
    account_label: str | None = None
    login_hint: str
    cta_label: str
    doc_url: str
    last_sync_at: str | None = None
    notes: list[str] = Field(default_factory=list)
    runtime_summary: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class IntegrationConnectRequest(BaseModel):
    account_label: str | None = Field(default=None, max_length=120)
    login_identifier: str | None = Field(default=None, max_length=200)


class IntegrationConnectResponse(BaseModel):
    integration: IntegrationSourceStatus
    launch_url: str | None = None
    local_only_notice: str


class DeviceSessionRecord(BaseModel):
    session_label: str = Field(..., min_length=1, max_length=160)
    session_type: str = Field(..., min_length=1, max_length=80)
    duration_minutes: float = Field(..., ge=0)
    distance_km: float | None = Field(default=None, ge=0)
    start_date: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1, max_length=80)


class HealthConnectDeviceSyncRequest(BaseModel):
    device_label: str | None = Field(default=None, max_length=120)
    bridge_source: Literal["health-connect-sdk", "google-fit-health-connect", "manual-import"] = "health-connect-sdk"
    recent_sessions: list[DeviceSessionRecord] = Field(default_factory=list, max_length=50)
    hydration_ml: float | None = Field(default=None, ge=0)
    body_weight_kg: float | None = Field(default=None, ge=0)
    step_count: int | None = Field(default=None, ge=0)
    active_energy_kcal: int | None = Field(default=None, ge=0)


class SamsungHealthDeviceSyncRequest(BaseModel):
    device_label: str | None = Field(default=None, max_length=120)
    bridge_source: Literal["samsung-health-sdk", "manual-import"] = "samsung-health-sdk"
    recent_sessions: list[DeviceSessionRecord] = Field(default_factory=list, max_length=50)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    resting_hr: int | None = Field(default=None, ge=0)
    energy_score: int | None = Field(default=None, ge=0, le=100)
    stress_level: str | None = Field(default=None, max_length=80)


class StravaCallbackRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1)
    state: str | None = Field(default=None, min_length=1)
    scope: str | None = None
    callback_url: str | None = Field(default=None, min_length=1)


class StravaCallbackResponse(BaseModel):
    integration: IntegrationSourceStatus
    token_exchange_ready: bool
    token_exchange_status: str
    local_only_notice: str


class StravaTokenExchangeResponse(BaseModel):
    integration: IntegrationSourceStatus
    token_exchange_status: str
    access_token_set: bool
    refresh_token_set: bool
    expires_at: int | None = None
    athlete_id: str | None = None
    local_only_notice: str


class ChatMessageRequest(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    feature: Literal["shared", "endurance", "nutrition"] = "shared"
    question: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessageRequest] = Field(default_factory=list, max_length=12)


class ChatGroundingItem(BaseModel):
    label: str
    value: str


class ChatResponse(BaseModel):
    feature: Literal["shared", "endurance", "nutrition"]
    provider: Literal["ollama", "groq", "stub"]
    model: str
    answer: str
    warnings: list[str] = Field(default_factory=list)
    token_strategy_note: str
    applied_prompt_title: str
    grounding: list[ChatGroundingItem] = Field(default_factory=list)
