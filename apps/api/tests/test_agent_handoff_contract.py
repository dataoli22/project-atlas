from app.features.shared.schemas.app import ChatMessageRequest
from app.features.shared.services.agent_runtime import build_execution_plan
from app.features.shared.services.ai import PROMPT_VERSION, build_ai_settings_response
from app.features.shared.services.state import shared_state


def _ai_settings():
    return build_ai_settings_response(
        default_provider="ollama",
        local_only_mode=True,
        self_hosted_distribution=True,
        allow_groq=False,
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.1:8b",
        ollama_embed_model="nomic-embed-text",
        ollama_api_key_set=False,
        groq_model="llama-3.1-8b-instant",
        groq_api_key_set=False,
        system_prompt_style="token-lean",
        guardrail_level="strict",
        max_context_items=6,
        max_context_tokens=2400,
        response_token_budget=450,
    )


def test_endurance_confidence_is_low_without_synced_strava_activity():
    plan = build_execution_plan(
        feature="endurance",
        question="What should I focus on?",
        history=[],
        ai_settings=_ai_settings(),
    )

    assert plan.confidence == "low"
    assert "not synced" in plan.connector_freshness.lower()
    assert "stub" in plan.confidence_reason.lower()


def test_endurance_confidence_is_high_with_synced_strava_activity():
    shared_state.connect_integration("strava", account_label="Runner", login_identifier="runner@example.com")
    shared_state.complete_strava_token_exchange(
        access_token="access-123",
        refresh_token="refresh-456",
        expires_at=1893456000,
        athlete_id="789",
    )
    shared_state.store_strava_sync(
        athlete_profile={"athlete_id": "789", "username": "runner", "firstname": "A", "lastname": "R"},
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

    plan = build_execution_plan(
        feature="endurance",
        question="What should I focus on?",
        history=[],
        ai_settings=_ai_settings(),
    )

    assert plan.confidence == "high"
    assert "1 activities synced" in plan.connector_freshness


def test_nutrition_confidence_reflects_pantry_state():
    shared_state.add_pantry_item("onions")

    plan = build_execution_plan(
        feature="nutrition",
        question="What should I buy?",
        history=[],
        ai_settings=_ai_settings(),
    )

    assert plan.confidence == "medium"
    assert "Pantry: 1 items" in plan.connector_freshness


def test_shared_confidence_reflects_any_connected_source():
    shared_state.connect_integration("health_connect", account_label="Pixel")
    shared_state.store_health_connect_sync(
        recent_sessions=[
            {
                "session_label": "Walk",
                "session_type": "Walk",
                "duration_minutes": 30,
                "distance_km": 2.0,
                "start_date": "2026-07-09T06:00:00Z",
                "source": "health-connect-live",
            }
        ],
        hydration_ml=2000,
        body_weight_kg=70,
        step_count=8000,
        active_energy_kcal=400,
    )

    plan = build_execution_plan(
        feature="shared",
        question="What's going on across the app?",
        history=[],
        ai_settings=_ai_settings(),
    )

    assert plan.confidence == "medium"
    assert "1 connector(s)" in plan.connector_freshness


def test_shared_confidence_is_low_with_no_connectors():
    plan = build_execution_plan(
        feature="shared",
        question="What's going on across the app?",
        history=[],
        ai_settings=_ai_settings(),
    )

    assert plan.confidence == "low"
    assert plan.connector_freshness == "No connectors synced."


def test_plan_carries_prompt_version_and_history_from_shared_module():
    history = [ChatMessageRequest(role="user", content="Hi")]

    plan = build_execution_plan(
        feature="shared",
        question="What should I check first?",
        history=history,
        ai_settings=_ai_settings(),
    )

    assert plan.prompt_version == PROMPT_VERSION
    assert f"Data confidence: {plan.confidence}" in plan.messages[1]["content"]
    assert f"Connector freshness: {plan.connector_freshness}" in plan.messages[1]["content"]
