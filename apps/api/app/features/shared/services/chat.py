from __future__ import annotations

import socket
from dataclasses import dataclass
from urllib import error
from urllib.parse import urlparse

from app.features.shared.schemas.app import (
    AISettings,
    ChatRequest,
    ChatResponse,
    ProviderErrorKind,
)
from app.features.shared.services.agent_runtime import build_execution_plan, fallback_answer
from app.features.shared.services.provider_clients import (
    GroqProviderClient,
    OllamaProviderClient,
    ProviderClient,
)


LOCAL_OLLAMA_BASE_URL = "http://localhost:11434"
_LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def _is_local_ollama_target(base_url: str) -> bool:
    hostname = (urlparse(base_url if "://" in base_url else f"http://{base_url}").hostname or "").lower()
    return hostname in _LOCAL_HOSTNAMES


def _classify_provider_error(exc: Exception) -> ProviderErrorKind:
    if isinstance(exc, error.HTTPError):
        if exc.code in (401, 403):
            return "auth_rejected"
        if exc.code == 404:
            return "model_missing"
        return "service_down"

    if isinstance(exc, (socket.timeout, TimeoutError)):
        return "timeout"

    if isinstance(exc, error.URLError):
        reason = getattr(exc, "reason", None)
        if isinstance(reason, ConnectionRefusedError) or "refused" in str(reason).lower():
            return "connection_refused"
        return "service_down"

    if isinstance(exc, OSError):
        return "service_down"

    return "other"


@dataclass
class _ProviderAttempt:
    label: str
    client: ProviderClient
    model: str


def _build_provider_attempts(
    *,
    plan_provider: str,
    plan_model: str,
    ai_settings: AISettings,
    ollama_api_key: str,
    groq_api_key: str,
) -> list[_ProviderAttempt]:
    """Build the ordered chain of providers to try for this request.

    The configured primary provider (Groq, or Ollama - local or cloud, depending on
    `ollama_base_url`) is tried first. If that primary is a cloud call (Groq, or Ollama pointed
    at a non-local base URL), on-device Ollama at the default local endpoint is appended as an
    automatic resilience fallback, using the same configured chat model. If the primary is
    already local Ollama, no separate fallback attempt is added - it would just fail the same
    way again. Only once every attempt in this chain fails does the caller fall back to the
    deterministic stub answer.
    """

    attempts: list[_ProviderAttempt] = []

    if plan_provider == "groq":
        if ai_settings.allow_groq and groq_api_key:
            attempts.append(
                _ProviderAttempt(
                    label="Groq",
                    client=GroqProviderClient(api_key=groq_api_key),
                    model=plan_model,
                )
            )
        primary_is_local = False
    else:
        attempts.append(
            _ProviderAttempt(
                label="Ollama" if _is_local_ollama_target(ai_settings.ollama_base_url) else "Ollama (cloud)",
                client=OllamaProviderClient(
                    base_url=ai_settings.ollama_base_url,
                    api_key=ollama_api_key,
                ),
                model=plan_model,
            )
        )
        primary_is_local = _is_local_ollama_target(ai_settings.ollama_base_url)

    if not primary_is_local:
        attempts.append(
            _ProviderAttempt(
                label="Ollama (on-device fallback)",
                client=OllamaProviderClient(base_url=LOCAL_OLLAMA_BASE_URL, api_key=""),
                model=ai_settings.ollama_model,
            )
        )

    return attempts


def build_chat_response(
    chat: ChatRequest,
    ai_settings: AISettings,
    ollama_api_key: str,
    groq_api_key: str,
) -> ChatResponse:
    plan = build_execution_plan(
        feature=chat.feature,
        question=chat.question,
        history=chat.history,
        ai_settings=ai_settings,
    )

    attempts = _build_provider_attempts(
        plan_provider=plan.provider,
        plan_model=plan.model,
        ai_settings=ai_settings,
        ollama_api_key=ollama_api_key,
        groq_api_key=groq_api_key,
    )

    fallback_notes: list[str] = []
    last_error_kind: ProviderErrorKind = "other"

    for attempt in attempts:
        try:
            provider_result = attempt.client.complete(
                model=attempt.model,
                messages=plan.messages,
                response_token_budget=ai_settings.response_token_budget,
            )
            if not provider_result.answer:
                raise ValueError(f"Empty response from {provider_result.provider}")

            return ChatResponse(
                feature=chat.feature,
                provider=provider_result.provider,
                model=provider_result.model,
                answer=provider_result.answer,
                warnings=[*plan.warnings, *fallback_notes],
                token_strategy_note=plan.token_strategy_note,
                applied_prompt_title=plan.prompt_title,
                grounding=plan.grounding,
            )
        except (error.URLError, TimeoutError, ValueError, OSError) as exc:
            last_error_kind = "other" if isinstance(exc, ValueError) else _classify_provider_error(exc)
            fallback_notes.append(f"{attempt.label} was unavailable, so Atlas tried the next option. ({exc})")

    if not attempts:
        fallback_notes.append(
            "No provider is configured and reachable, so Atlas used a local deterministic fallback."
        )

    return ChatResponse(
        feature=chat.feature,
        provider="stub",
        model=plan.model,
        answer=fallback_answer(chat.feature, chat.question, plan.grounding),
        warnings=[*plan.warnings, *fallback_notes],
        token_strategy_note=plan.token_strategy_note,
        applied_prompt_title=plan.prompt_title,
        grounding=plan.grounding,
        provider_error_kind=last_error_kind,
    )
