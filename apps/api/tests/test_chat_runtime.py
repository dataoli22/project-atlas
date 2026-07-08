from urllib.error import URLError

from app.features.shared.schemas.app import ChatMessageRequest, ChatRequest
from app.features.shared.services.ai import build_ai_settings_response
from app.features.shared.services import chat as chat_service
from app.features.shared.services.provider_clients import ProviderResult


def _build_ai_settings(**overrides):
    payload = {
        "default_provider": "ollama",
        "local_only_mode": True,
        "self_hosted_distribution": True,
        "allow_groq": False,
        "ollama_base_url": "http://localhost:11434",
        "ollama_model": "llama3.1:8b",
        "ollama_embed_model": "nomic-embed-text",
        "ollama_api_key_set": False,
        "groq_model": "llama-3.1-8b-instant",
        "groq_api_key_set": False,
        "system_prompt_style": "token-lean",
        "guardrail_level": "strict",
        "max_context_items": 6,
        "max_context_tokens": 2400,
        "response_token_budget": 450,
    }
    payload.update(overrides)
    return build_ai_settings_response(**payload)


def test_chat_uses_stub_fallback_when_remote_provider_is_selected():
    ai_settings = _build_ai_settings(
        default_provider="groq",
        local_only_mode=False,
        allow_groq=True,
        groq_model="llama-3.3-70b-versatile",
    )

    response = chat_service.build_chat_response(
        ChatRequest(feature="shared", question="What should I review next?"),
        ai_settings,
        ollama_api_key="",
        groq_api_key="",
    )

    assert response.provider == "stub"
    assert response.model == "llama-3.3-70b-versatile"
    assert response.applied_prompt_title == "Shared shell agent"
    assert any("Groq is not enabled with a local device key" in warning for warning in response.warnings)
    assert any(item.label == "AI runtime" and item.value == "Local-first Atlas" for item in response.grounding)


def test_chat_uses_stub_fallback_when_ollama_call_fails(monkeypatch):
    ai_settings = _build_ai_settings()

    class FailingOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            assert base_url == "http://localhost:11434"
            assert api_key == "atlas-key"

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            raise URLError("connection refused")

    monkeypatch.setattr(chat_service, "OllamaProviderClient", FailingOllamaClient)

    response = chat_service.build_chat_response(
        ChatRequest(feature="endurance", question="Should I push volume this week?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "stub"
    assert response.model == "llama3.1:8b"
    assert "Should I push volume this week?" in response.answer
    assert any("Primary provider was unavailable" in warning for warning in response.warnings)
    assert response.applied_prompt_title == "Endurance coach agent"


def test_chat_returns_ollama_response_when_runtime_succeeds(monkeypatch):
    ai_settings = _build_ai_settings(response_token_budget=512)
    history = [
        ChatMessageRequest(role="user", content=f"Earlier question {index}")
        for index in range(8)
    ]
    captured = {}

    class SuccessfulOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            captured["base_url"] = base_url
            captured["api_key"] = api_key

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            captured["model"] = model
            captured["messages"] = messages
            captured["response_token_budget"] = response_token_budget
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="Keep the plan steady and protect recovery.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", SuccessfulOllamaClient)

    response = chat_service.build_chat_response(
        ChatRequest(
            feature="nutrition",
            question="How should I simplify the shopping list?",
            history=history,
        ),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "ollama"
    assert response.model == "llama3.1:8b"
    assert response.answer == "Keep the plan steady and protect recovery."
    assert captured["base_url"] == "http://localhost:11434"
    assert captured["api_key"] == "atlas-key"
    assert captured["response_token_budget"] == 512
    assert captured["messages"][0]["role"] == "system"
    assert captured["messages"][-1] == {
        "role": "user",
        "content": "How should I simplify the shopping list?",
    }
    retained_history = [message["content"] for message in captured["messages"] if message["role"] == "user"][:-1]
    assert retained_history == [f"Earlier question {index}" for index in range(2, 8)]
    assert response.warnings == [
        "Atlas trimmed conversation history from 8 to 6 turns to stay token-lean."
    ]


def test_chat_grounding_includes_connected_integrations(monkeypatch):
    ai_settings = _build_ai_settings()

    class SuccessfulOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="Review the connected activity sources before changing load.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", SuccessfulOllamaClient)
    from app.features.shared.services.state import shared_state

    shared_state.connect_integration("strava", account_label="Runner", login_identifier="runner@example.com")

    response = chat_service.build_chat_response(
        ChatRequest(feature="endurance", question="What should I inspect first?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "ollama"
    assert any(item.label == "Connected sources" and item.value == "Strava" for item in response.grounding)
    assert any(item.label == "Strava OAuth state" for item in response.grounding)


def test_chat_grounding_reflects_token_ready_strava_runtime(monkeypatch):
    ai_settings = _build_ai_settings()

    class SuccessfulOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="Strava tokens are available locally.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", SuccessfulOllamaClient)
    from app.features.shared.services.state import shared_state

    shared_state.connect_integration("strava", account_label="Runner", login_identifier="runner@example.com")
    shared_state.complete_strava_token_exchange(
        access_token="access-123",
        refresh_token="refresh-456",
        expires_at=1893456000,
        athlete_id="789",
    )

    response = chat_service.build_chat_response(
        ChatRequest(feature="endurance", question="Can Atlas trust the Strava connection now?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "ollama"
    assert any(item.label == "Strava OAuth state" and item.value == "Access token ready" for item in response.grounding)
    assert any(item.label == "Strava token status" and item.value == "Local token available" for item in response.grounding)


def test_chat_grounding_reflects_synced_integration_counts(monkeypatch):
    ai_settings = _build_ai_settings()

    class SuccessfulOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="Use the synced device and Strava activity counts before changing training load.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", SuccessfulOllamaClient)
    from app.features.shared.services.state import shared_state

    shared_state.connect_integration("strava", account_label="Runner", login_identifier="runner@example.com")
    shared_state.complete_strava_token_exchange(
        access_token="access-123",
        refresh_token="refresh-456",
        expires_at=1893456000,
        athlete_id="789",
    )
    shared_state.store_strava_sync(
        athlete_profile={
            "athlete_id": "789",
            "username": "atlas-runner",
            "firstname": "Atlas",
            "lastname": "Runner",
        },
        recent_activities=[
            {
                "activity_id": "1",
                "name": "Morning Run",
                "sport_type": "Run",
                "moving_time_seconds": 3600,
                "distance_meters": 10000,
                "start_date": "2026-07-08T06:00:00Z",
            }
        ],
    )
    shared_state.connect_integration("health_connect", account_label="Pixel 10 Pro")
    shared_state.store_health_connect_sync(
        recent_sessions=[
            {
                "session_label": "Health Connect steady run",
                "session_type": "Run",
                "duration_minutes": 52,
                "distance_km": 8.6,
                "start_date": "2026-07-09T06:10:00Z",
                "source": "health-connect-live",
            },
            {
                "session_label": "Health Connect walk",
                "session_type": "Walk",
                "duration_minutes": 34,
                "distance_km": 2.8,
                "start_date": "2026-07-08T18:25:00Z",
                "source": "health-connect-live",
            },
        ],
        hydration_ml=2400,
        body_weight_kg=69.8,
        step_count=10840,
        active_energy_kcal=684,
    )
    shared_state.connect_integration("samsung_health", account_label="Galaxy Watch Ultra")
    shared_state.store_samsung_health_sync(
        recent_sessions=[
            {
                "session_label": "Samsung Health recovery walk",
                "session_type": "Walk",
                "duration_minutes": 28,
                "distance_km": 2.1,
                "start_date": "2026-07-09T19:00:00Z",
                "source": "samsung-health-live",
            },
            {
                "session_label": "Samsung Health mobility",
                "session_type": "Mobility",
                "duration_minutes": 22,
                "distance_km": 0.0,
                "start_date": "2026-07-08T20:00:00Z",
                "source": "samsung-health-live",
            },
        ],
        sleep_hours=7.4,
        resting_hr=52,
        energy_score=82,
        stress_level="Low",
    )

    response = chat_service.build_chat_response(
        ChatRequest(feature="endurance", question="What synced data should Atlas trust first?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "ollama"
    assert any(
        item.label == "Connected sources"
        and item.value == "Strava, Health Connect, Samsung Health"
        for item in response.grounding
    )
    assert any(item.label == "Strava synced activities" and item.value == "1" for item in response.grounding)
    assert any(item.label == "Health Connect sessions" and item.value == "2" for item in response.grounding)
    assert any(
        item.label == "Health Connect recovery inputs"
        and item.value == "2400 ml hydration, 10840 steps"
        for item in response.grounding
    )
    assert any(item.label == "Samsung Health sessions" and item.value == "2" for item in response.grounding)
    assert any(
        item.label == "Samsung recovery inputs"
        and item.value == "7.4 h sleep, energy 82"
        for item in response.grounding
    )
