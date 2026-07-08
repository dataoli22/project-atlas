from __future__ import annotations

from urllib import error

from app.features.shared.schemas.app import (
    AISettings,
    ChatRequest,
    ChatResponse,
)
from app.features.shared.services.agent_runtime import build_execution_plan, fallback_answer
from app.features.shared.services.provider_clients import GroqProviderClient, OllamaProviderClient


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

    try:
        if plan.provider == "groq":
            if not ai_settings.allow_groq or not groq_api_key:
                raise ValueError("Groq is not enabled with a local device key, so Atlas cannot use it.")
            provider_client = GroqProviderClient(api_key=groq_api_key)
        else:
            provider_client = OllamaProviderClient(
                base_url=ai_settings.ollama_base_url,
                api_key=ollama_api_key,
            )

        provider_result = provider_client.complete(
            model=plan.model,
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
            warnings=plan.warnings,
            token_strategy_note=plan.token_strategy_note,
            applied_prompt_title=plan.prompt_title,
            grounding=plan.grounding,
        )
    except (error.URLError, TimeoutError, ValueError, OSError) as exc:
        warnings = [
            *plan.warnings,
            f"Primary provider was unavailable, so Atlas used a local deterministic fallback. ({exc})",
        ]
        return ChatResponse(
            feature=chat.feature,
            provider="stub",
            model=plan.model,
            answer=fallback_answer(chat.feature, chat.question, plan.grounding),
            warnings=warnings,
            token_strategy_note=plan.token_strategy_note,
            applied_prompt_title=plan.prompt_title,
            grounding=plan.grounding,
        )
