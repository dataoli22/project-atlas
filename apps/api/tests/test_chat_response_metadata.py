from urllib.error import URLError

from app.features.shared.schemas.app import ChatRequest
from app.features.shared.services.ai import PROMPT_VERSION, build_ai_settings_response
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


def test_stub_response_reports_deterministic_only_provenance(monkeypatch):
    ai_settings = _build_ai_settings(default_provider="groq", allow_groq=True)

    class FailingClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            raise URLError("connection refused")

    monkeypatch.setattr(chat_service, "OllamaProviderClient", FailingClient)

    response = chat_service.build_chat_response(
        ChatRequest(feature="shared", question="What should I review next?"),
        ai_settings,
        ollama_api_key="",
        groq_api_key="",
    )

    assert response.provider == "stub"
    assert response.response_provenance == "deterministic-only"
    assert response.prompt_version == PROMPT_VERSION
    assert response.confidence in {"high", "medium", "low"}
    assert response.guardrail_passed is True
    assert response.guardrail_findings == []


def test_model_response_with_grounding_reports_model_with_grounding_provenance(monkeypatch):
    ai_settings = _build_ai_settings()

    class SuccessfulOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="Keep the plan steady and protect recovery this week.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", SuccessfulOllamaClient)

    response = chat_service.build_chat_response(
        ChatRequest(feature="endurance", question="What should I focus on?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    assert response.provider == "ollama"
    assert response.response_provenance == "model-with-grounding"
    assert response.prompt_version == PROMPT_VERSION
    assert response.guardrail_passed is True


def test_unsafe_model_answer_is_flagged_but_not_blocked(monkeypatch):
    ai_settings = _build_ai_settings()

    class UnsafeOllamaClient:
        def __init__(self, *, base_url: str, api_key: str) -> None:
            pass

        def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int):
            return ProviderResult(
                provider="ollama",
                model=model,
                answer="You have a sleep disorder - take 200mg of the usual medication tonight.",
            )

    monkeypatch.setattr(chat_service, "OllamaProviderClient", UnsafeOllamaClient)

    response = chat_service.build_chat_response(
        ChatRequest(feature="shared", question="Why am I tired?"),
        ai_settings,
        ollama_api_key="atlas-key",
        groq_api_key="",
    )

    # Advisory only - Atlas never blocks a response, per product decision.
    assert response.answer == "You have a sleep disorder - take 200mg of the usual medication tonight."
    assert response.guardrail_passed is False
    assert "Answer may state or imply a medical diagnosis." in response.guardrail_findings
    assert "Answer may include medication or dosing guidance." in response.guardrail_findings
    assert any("Atlas flagged this answer for review" in warning for warning in response.warnings)
