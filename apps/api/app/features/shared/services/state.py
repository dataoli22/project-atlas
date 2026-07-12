from __future__ import annotations

import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from app.core.config import build_market_registry, get_settings
from app.features.shared.schemas.app import (
    AISettings,
    AISettingsUpdate,
    AppLockSettings,
    AppLockUpdateRequest,
    AppPreferences,
    AppPreferencesUpdate,
    IntegrationConnectMode,
    IntegrationSourceKey,
    IntegrationSourceStatus,
    LocalizationSettings,
    LocalizationSettingsUpdate,
    PairedDevice,
    PairingConfirmRequest,
    PairingConfirmResponse,
    PairingStartResponse,
    ProfileSettings,
    ProfileSettingsUpdate,
    SearchSettings,
    SearchSettingsUpdate,
)
from app.features.shared.services.ai import build_ai_settings_response
from app.features.shared.services.app_lock import hash_pin, verify_pin
from app.features.shared.services.db import LocalStateDatabase
from app.features.shared.services.pairing import (
    MAX_PAIRING_ATTEMPTS,
    PAIRING_START_RATE_LIMIT_MAX_CALLS,
    PAIRING_START_RATE_LIMIT_WINDOW_SECONDS,
    detect_lan_addresses,
    generate_device_id,
    generate_device_token,
    generate_pairing_code,
    is_expired,
    pairing_code_expiry,
)
from app.features.shared.services.registry import (
    get_default_ai_settings,
    get_default_localization,
    get_default_preferences,
    get_default_profile,
    get_enabled_feature_keys,
)
from app.features.shared.services.secure_storage import build_local_secret_protector


class PairingRateLimitedError(Exception):
    """Raised when /pairing/start is called again before the cooldown window has elapsed."""


class SharedStateStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._preferences = get_default_preferences()
        self._profile = get_default_profile()
        self._localization = get_default_localization()
        self._ai_settings = get_default_ai_settings()
        self._integrations = _build_default_integrations()
        self._integration_runtime = _build_default_integration_runtime()
        self._nutrition_runtime = _build_default_nutrition_runtime()
        self._app_lock = _build_default_app_lock()
        self._pairing = _build_default_pairing()
        self._pairing_start_call_times: list[datetime] = []
        settings = get_settings()
        self._local_state_path = Path(settings.local_state_path)
        self._db = (
            None
            if self._persistence_disabled()
            else LocalStateDatabase(Path(settings.local_db_path))
        )
        self._secret_protector = build_local_secret_protector()
        self._ollama_api_key = settings.ollama_api_key
        self._groq_api_key = settings.groq_api_key
        self._brave_api_key = settings.brave_api_key
        self._load_persisted_state()

    def get_preferences(self) -> AppPreferences:
        with self._lock:
            return self._preferences.model_copy(deep=True)

    def update_preferences(self, payload: AppPreferencesUpdate) -> AppPreferences:
        with self._lock:
            allowed = set(get_enabled_feature_keys())
            requested = set(payload.enabled_feature_flags)

            if not requested:
                raise ValueError("At least one feature must remain enabled.")

            if not requested.issubset(allowed):
                raise ValueError("Requested feature flags include disabled or unknown features.")

            if payload.active_feature not in requested:
                raise ValueError("Active feature must also be present in enabled feature flags.")

            self._preferences = self._preferences.model_copy(update=payload.model_dump())
            self._persist_state_unlocked()
            return self._preferences.model_copy(deep=True)

    def mark_onboarding_complete(self) -> AppPreferences:
        with self._lock:
            self._preferences = self._preferences.model_copy(update={"has_completed_onboarding": True})
            self._persist_state_unlocked()
            return self._preferences.model_copy(deep=True)

    def get_profile(self) -> ProfileSettings:
        with self._lock:
            return self._profile.model_copy(deep=True)

    def update_profile(self, payload: ProfileSettingsUpdate) -> ProfileSettings:
        with self._lock:
            update_data = payload.model_dump(exclude_unset=True)
            # model_copy(update=...) does NOT re-validate - it assigns dict values straight onto
            # fields without coercing them back into nested models, so body_weight/hydration
            # would end up stored as raw dicts instead of BodyWeightMetric/HydrationMetric
            # instances (silently broke any code accessing .value/.unit on them as attributes,
            # like the hydration-target normalization in endurance/service.py).
            # model_validate() re-runs full validation, including nested submodels.
            merged = {**self._profile.model_dump(), **update_data}
            self._profile = ProfileSettings.model_validate(merged)
            self._persist_state_unlocked()
            return self._profile.model_copy(deep=True)

    def get_localization(self) -> LocalizationSettings:
        with self._lock:
            return self._localization.model_copy(deep=True)

    def update_localization(
        self, payload: LocalizationSettingsUpdate
    ) -> LocalizationSettings:
        with self._lock:
            market = next(
                market_def for market_def in build_market_registry() if market_def.code == payload.market
            )

            if payload.language not in market.supported_languages:
                raise ValueError(
                    f"Language '{payload.language}' is not supported for market '{payload.market}'."
                )

            if not payload.currency_override and payload.currency != market.default_currency:
                raise ValueError(
                    f"Currency override must be enabled to use '{payload.currency}' for market '{payload.market}'."
                )

            if not payload.language_override and payload.language != market.default_language:
                raise ValueError(
                    f"Language override must be enabled to use '{payload.language}' for market '{payload.market}'."
                )

            self._localization = self._localization.model_copy(update=payload.model_dump())
            self._persist_state_unlocked()
            return self._localization.model_copy(deep=True)

    def get_ai_settings(self) -> AISettings:
        with self._lock:
            return self._ai_settings.model_copy(deep=True)

    def get_ollama_api_key(self) -> str:
        with self._lock:
            return self._ollama_api_key

    def get_groq_api_key(self) -> str:
        with self._lock:
            return self._groq_api_key

    def update_ai_settings(self, payload: AISettingsUpdate) -> AISettings:
        with self._lock:
            if payload.local_only_mode:
                if payload.default_provider != "ollama":
                    raise ValueError("Local-only mode requires Ollama as the default provider.")
                if payload.allow_groq:
                    raise ValueError("Groq cannot be enabled while local-only mode is active.")

            if payload.default_provider == "groq" and not payload.allow_groq:
                raise ValueError("Enable Groq before making it the default provider.")

            if payload.clear_ollama_api_key:
                self._ollama_api_key = ""
            elif payload.ollama_api_key is not None:
                self._ollama_api_key = payload.ollama_api_key.strip()

            if payload.clear_groq_api_key:
                self._groq_api_key = ""
            elif payload.groq_api_key is not None:
                self._groq_api_key = payload.groq_api_key.strip()

            self._ai_settings = build_ai_settings_response(
                default_provider=payload.default_provider,
                local_only_mode=payload.local_only_mode,
                self_hosted_distribution=payload.self_hosted_distribution,
                allow_groq=payload.allow_groq,
                ollama_base_url=payload.ollama_base_url,
                ollama_model=payload.ollama_model,
                ollama_embed_model=payload.ollama_embed_model,
                ollama_api_key_set=bool(self._ollama_api_key),
                groq_model=payload.groq_model,
                groq_api_key_set=bool(self._groq_api_key),
                system_prompt_style=payload.system_prompt_style,
                guardrail_level=payload.guardrail_level,
                max_context_items=payload.max_context_items,
                max_context_tokens=payload.max_context_tokens,
                response_token_budget=payload.response_token_budget,
            )
            self._persist_state_unlocked()
            return self._ai_settings.model_copy(deep=True)

    def get_search_settings(self) -> SearchSettings:
        with self._lock:
            return SearchSettings(brave_api_key_set=bool(self._brave_api_key))

    def get_brave_api_key(self) -> str:
        with self._lock:
            return self._brave_api_key

    def update_search_settings(self, payload: SearchSettingsUpdate) -> SearchSettings:
        with self._lock:
            if payload.clear_brave_api_key:
                self._brave_api_key = ""
            elif payload.brave_api_key is not None:
                self._brave_api_key = payload.brave_api_key.strip()

            self._persist_state_unlocked()
            return SearchSettings(brave_api_key_set=bool(self._brave_api_key))

    def get_integrations(self) -> list[IntegrationSourceStatus]:
        with self._lock:
            return [self._integration_with_runtime_summary_unlocked(integration.key) for integration in self._integrations.values()]

    def connect_integration(
        self,
        source: IntegrationSourceKey,
        *,
        account_label: str | None = None,
        login_identifier: str | None = None,
    ) -> IntegrationSourceStatus:
        with self._lock:
            current = self._integrations[source]
            resolved_label = _resolve_account_label(
                source,
                connect_mode=current.connect_mode,
                account_label=account_label,
                login_identifier=login_identifier,
            )
            status = _status_for_connect(source)
            notes = _notes_for_source(source)

            if source == "strava" and login_identifier:
                notes = [f"Prepared OAuth handoff for {login_identifier.strip()}.", *notes]
            if source == "health_connect":
                self._integration_runtime["health_connect"]["permission_granted"] = True
                self._integration_runtime["health_connect"]["connected_device_label"] = resolved_label
                self._integration_runtime["health_connect"]["last_permission_at"] = datetime.now(timezone.utc).isoformat()
                notes = [
                    "Health Connect permission is marked as granted in the local runtime.",
                    "The next step is wiring the packaged Android adapter to replace stub sync data.",
                ]
            if source == "samsung_health":
                self._integration_runtime["samsung_health"]["sdk_consent_granted"] = True
                self._integration_runtime["samsung_health"]["connected_device_label"] = resolved_label
                self._integration_runtime["samsung_health"]["last_consent_at"] = datetime.now(timezone.utc).isoformat()
                notes = [
                    "Samsung Health SDK consent is marked as granted in the local runtime.",
                    "The next step is wiring the real Samsung SDK adapter in the packaged app.",
                ]

            self._integrations[source] = current.model_copy(
                update={
                    "connected": True,
                    "status": status,
                    "account_label": resolved_label,
                    "notes": notes,
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked(source)

    def disconnect_integration(self, source: IntegrationSourceKey) -> IntegrationSourceStatus:
        with self._lock:
            current = self._integrations[source]
            if source == "strava":
                self._integration_runtime["strava"] = _build_default_integration_runtime()["strava"]
            if source == "health_connect":
                self._integration_runtime["health_connect"] = _build_default_integration_runtime()["health_connect"]
            if source == "samsung_health":
                self._integration_runtime["samsung_health"] = _build_default_integration_runtime()["samsung_health"]
            self._integrations[source] = current.model_copy(
                update={
                    "connected": False,
                    "status": "disconnected",
                    "account_label": None,
                    "last_sync_at": None,
                    "notes": _notes_for_source(source),
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked(source)

    def sync_integration(self, source: IntegrationSourceKey) -> IntegrationSourceStatus:
        with self._lock:
            current = self._integrations[source]
            if not current.connected:
                raise ValueError("Connect the integration before running a sync.")

            self._integrations[source] = current.model_copy(
                update={
                    "status": "sync-stubbed",
                    "last_sync_at": datetime.now(timezone.utc).isoformat(),
                    "notes": [
                        "Sync is still running on replaceable stub data.",
                        "Adapters are modular so the real provider API can replace this contract later.",
                    ],
                }
            )
            self._persist_state_unlocked()
            if self._db is not None:
                self._db.record_sync_event(
                    source=source, status="sync-stubbed", detail={"stub": True}
                )
            return self._integration_with_runtime_summary_unlocked(source)

    def get_sync_history(self, *, source: str | None = None, limit: int = 50) -> list[dict]:
        with self._lock:
            if self._db is None:
                return []
            return self._db.list_sync_history(source=source, limit=limit)

    def prepare_strava_oauth(self) -> str:
        with self._lock:
            state_token = uuid4().hex
            self._integration_runtime["strava"]["pending_oauth_state"] = state_token
            self._persist_state_unlocked()
            return state_token

    def complete_strava_callback(self, *, code: str, state: str, scope: str | None = None) -> IntegrationSourceStatus:
        with self._lock:
            pending_state = self._integration_runtime["strava"]["pending_oauth_state"]
            if not pending_state or state != pending_state:
                raise ValueError("Strava OAuth state did not match the pending local session.")

            self._integration_runtime["strava"]["pending_oauth_state"] = None
            self._integration_runtime["strava"]["authorization_code"] = code
            self._integration_runtime["strava"]["granted_scope"] = scope
            self._integration_runtime["strava"]["token_exchange_ready"] = True

            current = self._integrations["strava"]
            self._integrations["strava"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "oauth-code-received",
                    "account_label": current.account_label or "Strava account",
                    "notes": [
                        "Authorization code received locally.",
                        "Next step is exchanging the code for tokens inside the device runtime.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("strava")

    def complete_strava_token_exchange(
        self,
        *,
        access_token: str,
        refresh_token: str,
        expires_at: int | None,
        athlete_id: str | None,
    ) -> IntegrationSourceStatus:
        with self._lock:
            self._integration_runtime["strava"]["access_token"] = access_token
            self._integration_runtime["strava"]["refresh_token"] = refresh_token
            self._integration_runtime["strava"]["expires_at"] = expires_at
            self._integration_runtime["strava"]["athlete_id"] = athlete_id
            self._integration_runtime["strava"]["access_token_set"] = bool(access_token)
            self._integration_runtime["strava"]["refresh_token_set"] = bool(refresh_token)
            self._integration_runtime["strava"]["token_exchange_ready"] = False
            self._integration_runtime["strava"]["authorization_code"] = None

            current = self._integrations["strava"]
            self._integrations["strava"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "token-ready",
                    "notes": [
                        "Strava tokens are now stored in the local runtime state.",
                        "The next step is using those tokens to sync athlete and activity data.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("strava")

    def refresh_strava_token(
        self,
        *,
        access_token: str,
        refresh_token: str,
        expires_at: int | None,
        athlete_id: str | None,
    ) -> IntegrationSourceStatus:
        with self._lock:
            self._integration_runtime["strava"]["access_token"] = access_token
            self._integration_runtime["strava"]["refresh_token"] = refresh_token
            self._integration_runtime["strava"]["expires_at"] = expires_at
            self._integration_runtime["strava"]["athlete_id"] = athlete_id
            self._integration_runtime["strava"]["access_token_set"] = bool(access_token)
            self._integration_runtime["strava"]["refresh_token_set"] = bool(refresh_token)
            self._integration_runtime["strava"]["last_token_refresh_at"] = datetime.now(timezone.utc).isoformat()

            current = self._integrations["strava"]
            self._integrations["strava"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "token-ready",
                    "notes": [
                        "Strava access token was refreshed inside the local runtime.",
                        "Atlas can continue live sync without routing through a centralized backend.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("strava")

    def store_strava_sync(
        self,
        *,
        athlete_profile: dict[str, object | None],
        recent_activities: list[dict[str, object | None]],
    ) -> IntegrationSourceStatus:
        with self._lock:
            synced_at = datetime.now(timezone.utc).isoformat()
            self._integration_runtime["strava"]["athlete_profile"] = athlete_profile
            self._integration_runtime["strava"]["recent_activities"] = [
                {"source": "strava-live", **item} for item in recent_activities
            ]
            # Append to permanent history (not the lock-reentrant self.record_health_sessions -
            # already holding self._lock here, which is non-reentrant). Strava's raw activity
            # fields (name/sport_type/moving_time_seconds/distance_meters) are normalized to the
            # common session_label/session_type/duration_minutes/distance_km shape health_sessions
            # uses for all sources, matching how endurance/service.py already reads either shape
            # via .get(x) or .get(y) fallbacks - persisting normalized keeps queries source-agnostic.
            if self._db is not None:
                self._db.record_health_sessions(
                    source="strava",
                    sessions=[
                        {
                            "session_label": item.get("name"),
                            "session_type": item.get("sport_type"),
                            "duration_minutes": (
                                item["moving_time_seconds"] / 60
                                if item.get("moving_time_seconds") is not None
                                else None
                            ),
                            "distance_km": (
                                item["distance_meters"] / 1000
                                if item.get("distance_meters") is not None
                                else None
                            ),
                            "start_date": item.get("start_date"),
                        }
                        for item in recent_activities
                    ],
                )

            current = self._integrations["strava"]
            self._integrations["strava"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "sync-live",
                    "last_sync_at": synced_at,
                    "notes": [
                        "Recent Strava activities were fetched into the local runtime state.",
                        "Endurance routes can now project real synced data without changing the UI contract.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("strava")

    def store_health_connect_sync(
        self,
        *,
        recent_sessions: list[dict[str, object | None]],
        hydration_ml: float | None,
        body_weight_kg: float | None,
        step_count: int | None,
        active_energy_kcal: int | None,
        bridge_source: str = "health-connect-sdk",
        device_label: str | None = None,
    ) -> IntegrationSourceStatus:
        with self._lock:
            synced_at = datetime.now(timezone.utc).isoformat()
            self._integration_runtime["health_connect"]["recent_sessions"] = recent_sessions
            self._integration_runtime["health_connect"]["hydration_ml"] = hydration_ml
            self._integration_runtime["health_connect"]["body_weight_kg"] = body_weight_kg
            self._integration_runtime["health_connect"]["step_count"] = step_count
            self._integration_runtime["health_connect"]["active_energy_kcal"] = active_energy_kcal
            self._integration_runtime["health_connect"]["bridge_source"] = bridge_source
            # Append to permanent history (already-locked, see store_strava_sync's comment on why
            # this isn't the lock-reentrant self.record_health_sessions/self.record_health_metric_readings).
            if self._db is not None:
                self._db.record_health_sessions(source="health_connect", sessions=list(recent_sessions))
                self._db.record_health_metric_readings(
                    source="health_connect",
                    recorded_at=synced_at,
                    readings={
                        "hydration_ml": hydration_ml,
                        "body_weight_kg": body_weight_kg,
                        "step_count": step_count,
                        "active_energy_kcal": active_energy_kcal,
                    },
                )
            self._integration_runtime["health_connect"]["sync_mode"] = (
                "permissions-local-stub"
                if bridge_source == "local-stub"
                else "device-sdk-bridge"
            )
            if device_label:
                self._integration_runtime["health_connect"]["connected_device_label"] = device_label
                self._integration_runtime["health_connect"]["permission_granted"] = True

            current = self._integrations["health_connect"]
            self._integrations["health_connect"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "sync-live",
                    "last_sync_at": synced_at,
                    "notes": [
                        "Health Connect device records were imported through the local SDK bridge.",
                        "These records can enrich endurance recovery context alongside Strava load.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("health_connect")

    def store_samsung_health_sync(
        self,
        *,
        recent_sessions: list[dict[str, object | None]],
        sleep_hours: float | None,
        resting_hr: int | None,
        energy_score: int | None,
        stress_level: str | None,
        bridge_source: str = "samsung-health-sdk",
        device_label: str | None = None,
    ) -> IntegrationSourceStatus:
        with self._lock:
            synced_at = datetime.now(timezone.utc).isoformat()
            self._integration_runtime["samsung_health"]["recent_sessions"] = recent_sessions
            self._integration_runtime["samsung_health"]["sleep_hours"] = sleep_hours
            self._integration_runtime["samsung_health"]["resting_hr"] = resting_hr
            self._integration_runtime["samsung_health"]["energy_score"] = energy_score
            self._integration_runtime["samsung_health"]["stress_level"] = stress_level
            self._integration_runtime["samsung_health"]["bridge_source"] = bridge_source
            if self._db is not None:
                self._db.record_health_sessions(source="samsung_health", sessions=list(recent_sessions))
                self._db.record_health_metric_readings(
                    source="samsung_health",
                    recorded_at=synced_at,
                    readings={
                        "sleep_hours": sleep_hours,
                        "resting_hr": resting_hr,
                        "energy_score": energy_score,
                        "stress_level": stress_level,
                    },
                )
            self._integration_runtime["samsung_health"]["sync_mode"] = (
                "sdk-local-stub"
                if bridge_source == "local-stub"
                else "device-sdk-bridge"
            )
            if device_label:
                self._integration_runtime["samsung_health"]["connected_device_label"] = device_label
                self._integration_runtime["samsung_health"]["sdk_consent_granted"] = True

            current = self._integrations["samsung_health"]
            self._integrations["samsung_health"] = current.model_copy(
                update={
                    "connected": True,
                    "status": "sync-live",
                    "last_sync_at": synced_at,
                    "notes": [
                        "Samsung Health device records were imported through the local SDK bridge.",
                        "These records can now support endurance readiness and recovery interpretation.",
                    ],
                }
            )
            self._persist_state_unlocked()
            return self._integration_with_runtime_summary_unlocked("samsung_health")

    def get_nutrition_runtime(self) -> dict[str, object]:
        """Return persisted nutrition refresh overrides + swap history (deep copy)."""
        with self._lock:
            return {
                "swap_history": [
                    dict(entry) for entry in self._nutrition_runtime["swap_history"]
                ],
                "last_refreshed_at": self._nutrition_runtime["last_refreshed_at"],
                "refresh_due_at": self._nutrition_runtime["refresh_due_at"],
                "refresh_reason": self._nutrition_runtime["refresh_reason"],
            }

    def check_database_health(self) -> tuple[bool, str]:
        with self._lock:
            if self._db is None:
                return True, "Persistence disabled for this run (test/in-memory mode)."
            return self._db.health_check()

    def get_pantry_items(self) -> list[str]:
        with self._lock:
            return list(self._nutrition_runtime["pantry_items"])

    def add_pantry_item(self, name: str) -> list[str]:
        with self._lock:
            normalized = name.strip()
            if not normalized:
                raise ValueError("Pantry item name cannot be empty.")
            existing = self._nutrition_runtime["pantry_items"]
            if not any(item.lower() == normalized.lower() for item in existing):
                existing.append(normalized)
            self._persist_state_unlocked()
            return list(existing)

    def remove_pantry_item(self, name: str) -> list[str]:
        with self._lock:
            normalized = name.strip().lower()
            existing = self._nutrition_runtime["pantry_items"]
            self._nutrition_runtime["pantry_items"] = [
                item for item in existing if item.lower() != normalized
            ]
            self._persist_state_unlocked()
            return list(self._nutrition_runtime["pantry_items"])

    def record_health_sessions(self, *, source: str, sessions: list[dict]) -> None:
        with self._lock:
            if self._db is None:
                return
            self._db.record_health_sessions(source=source, sessions=sessions)

    def query_health_sessions(
        self,
        *,
        source: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        with self._lock:
            if self._db is None:
                return []
            return self._db.query_health_sessions(source=source, since=since, until=until, limit=limit)

    def record_health_metric_readings(
        self, *, source: str, recorded_at: str, readings: dict[str, object]
    ) -> None:
        with self._lock:
            if self._db is None:
                return
            self._db.record_health_metric_readings(source=source, recorded_at=recorded_at, readings=readings)

    def query_health_metric_history(
        self,
        *,
        metric_name: str,
        source: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        with self._lock:
            if self._db is None:
                return []
            return self._db.query_health_metric_history(
                metric_name=metric_name, source=source, since=since, until=until, limit=limit
            )

    def list_meal_plan_entries(self, *, market_code: str) -> list[dict]:
        """Real per-meal rows for a market, or empty if persistence is disabled (test/in-memory
        mode) or nothing has been seeded yet - callers (nutrition/service.py's
        _resolve_blueprint()) treat empty as "seed from the static blueprint"."""
        with self._lock:
            if self._db is None:
                return []
            return self._db.list_meal_plan_entries(market_code=market_code)

    def upsert_meal_plan_entry(
        self,
        *,
        market_code: str,
        day: str,
        slot: str,
        dish_name: str,
        prep_focus: str,
        cook_time_minutes: int,
        leftover_plan: str,
        ingredients: list[dict],
        source: str,
    ) -> None:
        with self._lock:
            if self._db is None:
                return
            self._db.upsert_meal_plan_entry(
                market_code=market_code,
                day=day,
                slot=slot,
                dish_name=dish_name,
                prep_focus=prep_focus,
                cook_time_minutes=cook_time_minutes,
                leftover_plan=leftover_plan,
                ingredients=ingredients,
                source=source,
            )

    def record_meal_swap(
        self,
        *,
        market_code: str,
        day: str,
        slot: str,
        previous_dish_name: str | None,
        new_dish_name: str,
        reason: str,
        changed_by: str,
    ) -> None:
        with self._lock:
            if self._db is None:
                return
            self._db.record_meal_swap(
                market_code=market_code,
                day=day,
                slot=slot,
                previous_dish_name=previous_dish_name,
                new_dish_name=new_dish_name,
                reason=reason,
                changed_by=changed_by,
            )

    def list_meal_swap_history(self, *, market_code: str, limit: int = 20) -> list[dict]:
        with self._lock:
            if self._db is None:
                return []
            return self._db.list_meal_swap_history(market_code=market_code, limit=limit)

    def record_nutrition_refresh(
        self,
        *,
        outgoing_entry: dict[str, str],
        last_refreshed_at: str,
        refresh_due_at: str,
        refresh_reason: str,
    ) -> None:
        """Preserve the outgoing plan in swap history and advance refresh overrides."""
        with self._lock:
            history = self._nutrition_runtime["swap_history"]
            history.insert(0, dict(outgoing_entry))
            self._nutrition_runtime["last_refreshed_at"] = last_refreshed_at
            self._nutrition_runtime["refresh_due_at"] = refresh_due_at
            self._nutrition_runtime["refresh_reason"] = refresh_reason
            self._persist_state_unlocked()
            if self._db is not None:
                self._db.record_planner_generation(
                    reason=refresh_reason, plan_snapshot=dict(outgoing_entry)
                )

    def get_planner_generation_history(self, *, limit: int = 20) -> list[dict]:
        with self._lock:
            if self._db is None:
                return []
            return self._db.list_planner_generation_history(limit=limit)

    def get_app_lock_settings(self) -> AppLockSettings:
        with self._lock:
            return AppLockSettings(
                enabled=self._app_lock["enabled"],
                has_pin=self._app_lock["pin_hash"] is not None,
                updated_at=self._app_lock["updated_at"],
            )

    def update_app_lock(self, payload: AppLockUpdateRequest) -> AppLockSettings:
        with self._lock:
            currently_enabled = self._app_lock["enabled"]

            if currently_enabled and self._app_lock["pin_hash"] is not None:
                if not payload.current_pin or not verify_pin(
                    payload.current_pin,
                    salt_hex=self._app_lock["salt"],
                    hash_hex=self._app_lock["pin_hash"],
                    iterations=self._app_lock["iterations"],
                ):
                    raise ValueError("The current PIN is required to change or disable the app lock.")

            if payload.enabled:
                if payload.pin:
                    hashed = hash_pin(payload.pin)
                    self._app_lock["pin_hash"] = hashed.hash_hex
                    self._app_lock["salt"] = hashed.salt_hex
                    self._app_lock["iterations"] = hashed.iterations
                elif self._app_lock["pin_hash"] is None:
                    raise ValueError("A PIN is required to enable the app lock.")
                self._app_lock["enabled"] = True
            else:
                self._app_lock["enabled"] = False
                self._app_lock["pin_hash"] = None
                self._app_lock["salt"] = None

            self._app_lock["updated_at"] = datetime.now(timezone.utc).isoformat()
            self._persist_state_unlocked()

            return AppLockSettings(
                enabled=self._app_lock["enabled"],
                has_pin=self._app_lock["pin_hash"] is not None,
                updated_at=self._app_lock["updated_at"],
            )

    def verify_app_lock_pin(self, pin: str) -> bool:
        with self._lock:
            if not self._app_lock["enabled"] or self._app_lock["pin_hash"] is None:
                return True

            return verify_pin(
                pin,
                salt_hex=self._app_lock["salt"],
                hash_hex=self._app_lock["pin_hash"],
                iterations=self._app_lock["iterations"],
            )

    def start_device_pairing(self) -> PairingStartResponse:
        with self._lock:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(seconds=PAIRING_START_RATE_LIMIT_WINDOW_SECONDS)
            self._pairing_start_call_times = [
                call_time for call_time in self._pairing_start_call_times if call_time >= window_start
            ]
            if len(self._pairing_start_call_times) >= PAIRING_START_RATE_LIMIT_MAX_CALLS:
                raise PairingRateLimitedError(
                    f"Too many pairing attempts started in the last "
                    f"{PAIRING_START_RATE_LIMIT_WINDOW_SECONDS}s. Wait a moment and try again."
                )
            self._pairing_start_call_times.append(now)

            code = generate_pairing_code()
            expires_at = pairing_code_expiry()
            self._pairing["pending_code"] = code
            self._pairing["pending_expires_at"] = expires_at
            self._pairing["attempts"] = 0
            self._persist_state_unlocked()

            return PairingStartResponse(
                code=code,
                expires_at=expires_at,
                lan_addresses=detect_lan_addresses(),
                port=get_settings().api_port,
            )

    def confirm_device_pairing(self, payload: PairingConfirmRequest) -> PairingConfirmResponse:
        with self._lock:
            pending_code = self._pairing["pending_code"]
            expires_at = self._pairing["pending_expires_at"]

            if not pending_code:
                raise ValueError("No pairing is in progress. Start pairing again on the desktop.")

            if not expires_at or is_expired(expires_at):
                self._pairing["pending_code"] = None
                self._pairing["pending_expires_at"] = None
                self._persist_state_unlocked()
                raise ValueError("Pairing code expired. Start pairing again on the desktop.")

            if not hmac.compare_digest(payload.code, pending_code):
                self._pairing["attempts"] += 1
                if self._pairing["attempts"] >= MAX_PAIRING_ATTEMPTS:
                    # Invalidate the code outright after repeated wrong guesses rather than just
                    # rate-limiting - a 6-digit code has only 1,000,000 possibilities, so bounding
                    # the *number of guesses* against one code matters far more than slowing down
                    # individual requests. A fresh code requires starting pairing again on the
                    # desktop, which a remote attacker cannot do.
                    self._pairing["pending_code"] = None
                    self._pairing["pending_expires_at"] = None
                    self._persist_state_unlocked()
                    raise ValueError(
                        "Too many incorrect attempts. Start pairing again on the desktop."
                    )
                self._persist_state_unlocked()
                raise ValueError("Pairing code did not match. Start pairing again on the desktop.")

            self._pairing["pending_code"] = None
            self._pairing["pending_expires_at"] = None
            self._pairing["attempts"] = 0

            device_id = generate_device_id()
            token = generate_device_token()
            hashed = hash_pin(token)
            now = datetime.now(timezone.utc).isoformat()

            self._pairing["devices"][device_id] = {
                "device_name": payload.device_name.strip(),
                "token_hash": hashed.hash_hex,
                "token_salt": hashed.salt_hex,
                "token_iterations": hashed.iterations,
                "paired_at": now,
                "last_sync_at": None,
            }
            self._persist_state_unlocked()

            return PairingConfirmResponse(
                device_id=device_id,
                device_token=token,
                device_name=payload.device_name.strip(),
            )

    def get_paired_devices(self) -> list[PairedDevice]:
        with self._lock:
            return [
                PairedDevice(
                    device_id=device_id,
                    device_name=entry["device_name"],
                    paired_at=entry["paired_at"],
                    last_sync_at=entry["last_sync_at"],
                )
                for device_id, entry in self._pairing["devices"].items()
            ]

    def revoke_paired_device(self, device_id: str) -> None:
        with self._lock:
            if device_id not in self._pairing["devices"]:
                raise ValueError("No paired device found with that ID.")
            del self._pairing["devices"][device_id]
            self._persist_state_unlocked()

    def verify_device_token(self, device_id: str, token: str) -> bool:
        with self._lock:
            entry = self._pairing["devices"].get(device_id)
            if entry is None:
                return False

            is_valid = verify_pin(
                token,
                salt_hex=entry["token_salt"],
                hash_hex=entry["token_hash"],
                iterations=entry["token_iterations"],
            )
            if is_valid:
                entry["last_sync_at"] = datetime.now(timezone.utc).isoformat()
                self._persist_state_unlocked()
            return is_valid

    def get_integration_runtime_snapshot(self) -> dict[str, dict[str, object | None]]:
        with self._lock:
            return {
                key: value.copy()
                for key, value in self._integration_runtime.items()
            }

    def _runtime_summary_for_integration(
        self, source: IntegrationSourceKey
    ) -> dict[str, str | int | float | bool | None]:
        if source == "health_connect":
            runtime = self._integration_runtime["health_connect"]
            sessions = runtime.get("recent_sessions")
            return {
                "permission_granted": bool(runtime.get("permission_granted")),
                "connected_device_label": runtime.get("connected_device_label"),
                "last_permission_at": runtime.get("last_permission_at"),
                "hydration_ml": runtime.get("hydration_ml"),
                "body_weight_kg": runtime.get("body_weight_kg"),
                "step_count": runtime.get("step_count"),
                "active_energy_kcal": runtime.get("active_energy_kcal"),
                "bridge_source": runtime.get("bridge_source"),
                "synced_session_count": len(sessions) if isinstance(sessions, list) else 0,
                "sync_mode": runtime.get("sync_mode"),
            }
        if source == "samsung_health":
            runtime = self._integration_runtime["samsung_health"]
            sessions = runtime.get("recent_sessions")
            return {
                "consent_granted": bool(runtime.get("sdk_consent_granted")),
                "connected_device_label": runtime.get("connected_device_label"),
                "last_consent_at": runtime.get("last_consent_at"),
                "supported_metric_count": runtime.get("supported_metric_count"),
                "sleep_hours": runtime.get("sleep_hours"),
                "resting_hr": runtime.get("resting_hr"),
                "energy_score": runtime.get("energy_score"),
                "stress_level": runtime.get("stress_level"),
                "bridge_source": runtime.get("bridge_source"),
                "synced_session_count": len(sessions) if isinstance(sessions, list) else 0,
                "sync_mode": runtime.get("sync_mode"),
            }
        if source != "strava":
            return {}

        runtime = self._integration_runtime["strava"]
        athlete = runtime.get("athlete_profile")
        activities = runtime.get("recent_activities")
        athlete_name = None
        if isinstance(athlete, dict):
            first = str(athlete.get("firstname") or "").strip()
            last = str(athlete.get("lastname") or "").strip()
            athlete_name = " ".join(part for part in [first, last] if part) or athlete.get("username")

        return {
            "token_ready": bool(runtime.get("access_token_set")),
            "refresh_ready": bool(runtime.get("refresh_token_set")),
            "token_exchange_ready": bool(runtime.get("token_exchange_ready")),
            "expires_at": runtime.get("expires_at"),
            "athlete_name": athlete_name,
            "athlete_id": runtime.get("athlete_id"),
            "last_token_refresh_at": runtime.get("last_token_refresh_at"),
            "synced_activity_count": len(activities) if isinstance(activities, list) else 0,
        }

    def _integration_with_runtime_summary_unlocked(
        self, source: IntegrationSourceKey
    ) -> IntegrationSourceStatus:
        integration = self._integrations[source]
        return integration.model_copy(
            update={"runtime_summary": self._runtime_summary_for_integration(source)},
            deep=True,
        )

    def _load_persisted_state(self) -> None:
        if self._persistence_disabled():
            return

        payload = self._db.get_json("shared_state") if self._db else None

        if payload is None and self._local_state_path.exists():
            try:
                payload = json.loads(self._local_state_path.read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                payload = None
            if payload is not None and self._db:
                self._db.set_json("shared_state", payload)

        if payload is None:
            return

        integrations_payload = payload.get("integrations", {})
        for key, value in integrations_payload.items():
            if key in self._integrations and isinstance(value, dict):
                self._integrations[key] = self._integrations[key].model_copy(update=value)

        runtime_payload = payload.get("integration_runtime", {})
        for key, value in runtime_payload.items():
            if key in self._integration_runtime and isinstance(value, dict):
                self._integration_runtime[key].update(value)

        nutrition_payload = payload.get("nutrition_runtime", {})
        if isinstance(nutrition_payload, dict):
            history = nutrition_payload.get("swap_history")
            if isinstance(history, list):
                self._nutrition_runtime["swap_history"] = [
                    dict(entry) for entry in history if isinstance(entry, dict)
                ]
            for key in ("last_refreshed_at", "refresh_due_at", "refresh_reason"):
                if key in nutrition_payload:
                    self._nutrition_runtime[key] = nutrition_payload[key]
            pantry_items = nutrition_payload.get("pantry_items")
            if isinstance(pantry_items, list):
                self._nutrition_runtime["pantry_items"] = [
                    str(item) for item in pantry_items if isinstance(item, str)
                ]

        app_lock_payload = payload.get("app_lock", {})
        if isinstance(app_lock_payload, dict):
            for key in ("enabled", "pin_hash", "salt", "iterations", "updated_at"):
                if key in app_lock_payload:
                    self._app_lock[key] = app_lock_payload[key]

        pairing_payload = payload.get("pairing", {})
        if isinstance(pairing_payload, dict):
            for key in ("pending_code", "pending_expires_at", "attempts"):
                if key in pairing_payload:
                    self._pairing[key] = pairing_payload[key]
            devices = pairing_payload.get("devices")
            if isinstance(devices, dict):
                self._pairing["devices"] = devices

        preferences_payload = payload.get("preferences")
        if isinstance(preferences_payload, dict):
            self._preferences = self._preferences.model_copy(update=preferences_payload)

        profile_payload = payload.get("profile")
        if isinstance(profile_payload, dict):
            # model_validate, not model_copy(update=...) - see update_profile's comment. The
            # persisted payload's body_weight/hydration are plain JSON dicts; model_copy would
            # assign them straight onto the fields without coercing them back into
            # BodyWeightMetric/HydrationMetric instances.
            self._profile = ProfileSettings.model_validate(
                {**self._profile.model_dump(), **profile_payload}
            )

        localization_payload = payload.get("localization")
        if isinstance(localization_payload, dict):
            self._localization = self._localization.model_copy(update=localization_payload)

        ai_settings_payload = payload.get("ai_settings")
        if isinstance(ai_settings_payload, dict):
            # model_validate, not model_copy(update=...) - same reasoning as the profile restore
            # above. prompt_profiles is a nested list[AgentPromptProfile]; model_copy would leave
            # each entry as a raw dict instead of a validated model.
            self._ai_settings = AISettings.model_validate(
                {**self._ai_settings.model_dump(), **ai_settings_payload}
            )

        self._ollama_api_key = self._secret_protector.unprotect(
            payload.get("ollama_api_key_protected"), key="ollama_api_key"
        ) or self._ollama_api_key
        self._groq_api_key = self._secret_protector.unprotect(
            payload.get("groq_api_key_protected"), key="groq_api_key"
        ) or self._groq_api_key
        self._brave_api_key = self._secret_protector.unprotect(
            payload.get("brave_api_key_protected"), key="brave_api_key"
        ) or self._brave_api_key

        self._restore_protected_runtime_secrets_unlocked()

    def _persist_state_unlocked(self) -> None:
        if self._persistence_disabled() or self._db is None:
            return

        payload = {
            "integrations": {
                key: value.model_dump(mode="json")
                for key, value in self._integrations.items()
            },
            "integration_runtime": self._serialized_runtime_payload_unlocked(),
            "nutrition_runtime": {
                "swap_history": [dict(entry) for entry in self._nutrition_runtime["swap_history"]],
                "last_refreshed_at": self._nutrition_runtime["last_refreshed_at"],
                "refresh_due_at": self._nutrition_runtime["refresh_due_at"],
                "refresh_reason": self._nutrition_runtime["refresh_reason"],
                "pantry_items": list(self._nutrition_runtime["pantry_items"]),
            },
            "app_lock": dict(self._app_lock),
            "pairing": {
                "pending_code": self._pairing["pending_code"],
                "pending_expires_at": self._pairing["pending_expires_at"],
                "attempts": self._pairing["attempts"],
                "devices": self._pairing["devices"],
            },
            "preferences": self._preferences.model_dump(mode="json"),
            "profile": self._profile.model_dump(mode="json"),
            "localization": self._localization.model_dump(mode="json"),
            "ai_settings": self._ai_settings.model_dump(mode="json"),
            "ollama_api_key_protected": self._secret_protector.protect(
                self._ollama_api_key, key="ollama_api_key"
            ),
            "groq_api_key_protected": self._secret_protector.protect(
                self._groq_api_key, key="groq_api_key"
            ),
            "brave_api_key_protected": self._secret_protector.protect(
                self._brave_api_key, key="brave_api_key"
            ),
        }
        self._db.set_json("shared_state", payload)

    def _persistence_disabled(self) -> bool:
        return "PYTEST_CURRENT_TEST" in os.environ

    def _serialized_runtime_payload_unlocked(self) -> dict[str, dict[str, object | None]]:
        payload = {
            key: value.copy()
            for key, value in self._integration_runtime.items()
        }
        strava_runtime = payload.get("strava")
        if isinstance(strava_runtime, dict):
            access_token = strava_runtime.pop("access_token", None)
            refresh_token = strava_runtime.pop("refresh_token", None)
            strava_runtime["access_token_protected"] = self._secret_protector.protect(
                str(access_token or ""), key="strava_access_token"
            )
            strava_runtime["refresh_token_protected"] = self._secret_protector.protect(
                str(refresh_token or ""), key="strava_refresh_token"
            )
        return payload

    def _restore_protected_runtime_secrets_unlocked(self) -> None:
        strava_runtime = self._integration_runtime.get("strava")
        if not isinstance(strava_runtime, dict):
            return

        protected_access = strava_runtime.pop("access_token_protected", None)
        protected_refresh = strava_runtime.pop("refresh_token_protected", None)

        strava_runtime["access_token"] = self._secret_protector.unprotect(
            protected_access, key="strava_access_token"
        )
        strava_runtime["refresh_token"] = self._secret_protector.unprotect(
            protected_refresh, key="strava_refresh_token"
        )
        strava_runtime["access_token_set"] = bool(strava_runtime["access_token"])
        strava_runtime["refresh_token_set"] = bool(strava_runtime["refresh_token"])

    def export_backup(self) -> dict[str, object]:
        """Export the full local database as a portable backup payload.

        Secrets (API keys, OAuth tokens) are exported in their already-protected form
        (OS-native encrypted/keychain-backed), never in plaintext, so the backup file is safe to
        move between the same user's own devices but is not a generic "share this with anyone"
        artifact - protected secrets tied to macOS Keychain/libsecret entries only unprotect on
        the machine that created them; DPAPI-protected secrets only unprotect for the same
        Windows user account.
        """
        with self._lock:
            if self._db is None:
                raise ValueError("Local persistence is disabled; nothing to export.")
            return {
                "backup_format_version": 1,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "app_state": self._db.export_all(),
            }

    def import_backup(self, payload: dict[str, object]) -> None:
        """Restore a backup previously produced by `export_backup`.

        Overwrites all current local app_state keys with the backup's contents, then reloads
        in-memory state from the restored database so the running process reflects the backup
        immediately (no restart required).
        """
        with self._lock:
            if self._db is None:
                raise ValueError("Local persistence is disabled; nothing to import into.")
            if payload.get("backup_format_version") != 1:
                raise ValueError("Unrecognized backup format version.")
            app_state = payload.get("app_state")
            if not isinstance(app_state, dict):
                raise ValueError("Backup payload's app_state must be an object.")
            if app_state:
                self._db.set_many_json(app_state)
            self._load_persisted_state()


def _build_default_integrations() -> dict[IntegrationSourceKey, IntegrationSourceStatus]:
    return {
        "strava": _integration_status(
            key="strava",
            title="Strava",
            connect_mode="oauth",
            login_hint="Use a Strava account email or athlete label before launching OAuth.",
            cta_label="Connect Strava account",
            doc_url="https://developers.strava.com/docs/authentication/",
            notes=[
                "Real implementation will launch Strava OAuth from the packaged desktop or phone runtime.",
                "This stub keeps the UI and API contract ready for later token exchange work.",
            ],
        ),
        "health_connect": _integration_status(
            key="health_connect",
            title="Health Connect",
            connect_mode="device-permission",
            login_hint="Health Connect uses Android device permissions rather than a separate web login.",
            cta_label="Authorize Health Connect",
            doc_url="https://developer.android.com/health-and-fitness/guides/health-connect",
            notes=[
                "Real implementation will request local Android permissions from the app package.",
                "Google Fit style history should flow through Health Connect where available.",
            ],
        ),
        "samsung_health": _integration_status(
            key="samsung_health",
            title="Samsung Health",
            connect_mode="sdk-consent",
            login_hint="Samsung Health relies on SDK consent inside the device app flow.",
            cta_label="Grant Samsung Health consent",
            doc_url="https://developer.samsung.com/health/android",
            notes=[
                "Real implementation will use the Samsung Health SDK inside the packaged app.",
                "Consent and sync remain local to the user-owned device runtime.",
            ],
        ),
    }


def _integration_status(
    *,
    key: IntegrationSourceKey,
    title: str,
    connect_mode: IntegrationConnectMode,
    login_hint: str,
    cta_label: str,
    doc_url: str,
    notes: list[str],
) -> IntegrationSourceStatus:
    return IntegrationSourceStatus(
        key=key,
        title=title,
        connect_mode=connect_mode,
        connected=False,
        status="disconnected",
        account_label=None,
        login_hint=login_hint,
        cta_label=cta_label,
        doc_url=doc_url,
        last_sync_at=None,
        notes=notes,
    )


def _resolve_account_label(
    source: IntegrationSourceKey,
    *,
    connect_mode: IntegrationConnectMode,
    account_label: str | None,
    login_identifier: str | None,
) -> str:
    normalized_label = (account_label or "").strip()
    normalized_login = (login_identifier or "").strip()

    if normalized_label:
        return normalized_label
    if normalized_login:
        return normalized_login
    if source == "health_connect":
        return "This device"
    if source == "samsung_health":
        return "Samsung Health on this device"
    if connect_mode == "oauth":
        return "Strava account"
    return "Local device"


def _status_for_connect(source: IntegrationSourceKey) -> str:
    if source == "strava":
        return "oauth-ready"
    if source == "health_connect":
        return "device-permission-required"
    return "sdk-consent-required"


def _notes_for_source(source: IntegrationSourceKey) -> list[str]:
    return _build_default_integrations()[source].notes


def _build_default_nutrition_runtime() -> dict[str, object]:
    return {
        "swap_history": [],
        "last_refreshed_at": None,
        "refresh_due_at": None,
        "refresh_reason": None,
        "pantry_items": [],
    }


def _build_default_app_lock() -> dict[str, object]:
    return {
        "enabled": False,
        "pin_hash": None,
        "salt": None,
        "iterations": None,
        "updated_at": None,
    }


def _build_default_pairing() -> dict[str, object]:
    return {
        "pending_code": None,
        "pending_expires_at": None,
        "attempts": 0,
        "devices": {},
    }


def _build_default_integration_runtime() -> dict[str, dict[str, object | None]]:
    return {
        "strava": {
            "pending_oauth_state": None,
            "authorization_code": None,
            "granted_scope": None,
            "token_exchange_ready": False,
            "access_token_set": False,
            "refresh_token_set": False,
            "access_token": None,
            "refresh_token": None,
            "expires_at": None,
            "athlete_id": None,
            "last_token_refresh_at": None,
            "athlete_profile": None,
            "recent_activities": [],
        },
            "health_connect": {
                "permission_granted": False,
                "connected_device_label": None,
                "last_permission_at": None,
                "hydration_ml": None,
                "body_weight_kg": None,
                "step_count": None,
                "active_energy_kcal": None,
                "bridge_source": None,
                "recent_sessions": [],
                "sync_mode": "permissions-local-stub",
            },
        "samsung_health": {
            "sdk_consent_granted": False,
            "connected_device_label": None,
            "last_consent_at": None,
                "supported_metric_count": 5,
                "sleep_hours": None,
                "resting_hr": None,
                "energy_score": None,
                "stress_level": None,
                "bridge_source": None,
                "recent_sessions": [],
                "sync_mode": "sdk-local-stub",
            },
    }


shared_state = SharedStateStore()
