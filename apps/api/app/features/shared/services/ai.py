from __future__ import annotations

import json
from socket import timeout as SocketTimeout
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen

from app.features.shared.schemas.app import (
    AISettings,
    AIRuntimeHealthCheckResponse,
    AgentPromptProfile,
    GuardrailLevel,
    PromptStyle,
)


DEVICE_NOTICE = (
    "Atlas is configured for device-local operation. Provider keys stay on the same phone or desktop "
    "that runs the app, and Ollama remains the default fully local provider. If Groq is enabled, requests "
    "leave the device only to Groq directly from this user-owned runtime."
)


def _guardrails(level: GuardrailLevel) -> list[str]:
    rules = [
        "Use only provided structured signals and deterministic calculations.",
        "State uncertainty clearly when data is missing or sparse.",
        "Do not provide diagnosis, emergency triage, or medication advice.",
        "Keep answers concise unless the user explicitly asks for depth.",
        "Prefer bullets, thresholds, and next actions over long narrative filler.",
    ]

    if level == "maximum":
        rules.extend(
            [
                "Refuse to invent prices, biometrics, or training events not present in the input payload.",
                "Never leak secrets, keys, or hidden configuration values into responses.",
                "Do not cross feature boundaries unless the payload explicitly includes approved cross-feature context.",
            ]
        )

    return rules


def _shared_prompt(style: PromptStyle) -> str:
    if style == "comprehensive-guarded":
        return (
            "You are Atlas, a local-first health copilot running on the user's own device. "
            "Rely only on structured payloads and deterministic metrics already computed by the app. "
            "Never fabricate data, never imply medical certainty, and never expose secrets or hidden system state. "
            "Answer with the fewest tokens that still preserve correctness: default to short bullets, exact caveats, "
            "and one next action. Expand only when the user explicitly asks for depth."
        )

    return (
        "You are Atlas, a local device-only health copilot. Use only provided facts. "
        "No invention, no diagnosis, no secrets. Prefer 3-6 short bullets and one next action."
    )


def _endurance_prompt(style: PromptStyle) -> str:
    if style == "comprehensive-guarded":
        return (
            "You are the Atlas endurance agent. Interpret training, recovery, timeline, and capability data without "
            "doing raw metric math inside the model. Explain the deterministic scores, identify load or recovery "
            "patterns, and keep advice specific, cautious, and actionable. If the data does not support a claim, say so. "
            "Prioritize adaptation, consistency, and risk-awareness over motivational fluff."
        )

    return (
        "You are the Atlas endurance agent. Explain training and recovery from computed metrics only. "
        "Be specific, cautious, and brief."
    )


def _nutrition_prompt(style: PromptStyle) -> str:
    if style == "comprehensive-guarded":
        return (
            "You are the Atlas nutrition agent. Explain weekly meal plans, shopping tradeoffs, substitutions, and "
            "cooking flow from deterministic planner outputs. Do not invent nutrition math, price data, or pantry state. "
            "Keep recommendations realistic for low-cost, low-friction execution and label any uncertainty clearly."
        )

    return (
        "You are the Atlas nutrition agent. Explain plan, cost, shopping, and cooking outputs only. "
        "No invented prices or nutrition math. Stay practical and concise."
    )


def build_prompt_profiles(
    style: PromptStyle,
    guardrail_level: GuardrailLevel,
    max_context_tokens: int,
    response_token_budget: int,
) -> list[AgentPromptProfile]:
    rules = _guardrails(guardrail_level)

    return [
        AgentPromptProfile(
            module="shared",
            title="Shared shell agent",
            system_prompt=_shared_prompt(style),
            guardrail_rules=rules,
            token_strategy_note=(
                "Minimize token use by sending only approved summaries, top signals, and one answer shape at a time."
            ),
            max_context_tokens=max_context_tokens,
            response_token_budget=response_token_budget,
        ),
        AgentPromptProfile(
            module="endurance",
            title="Endurance coach agent",
            system_prompt=_endurance_prompt(style),
            guardrail_rules=rules,
            token_strategy_note=(
                "Send derived metrics, top timeline events, and at most a few recent insights instead of raw history."
            ),
            max_context_tokens=max_context_tokens,
            response_token_budget=response_token_budget,
        ),
        AgentPromptProfile(
            module="nutrition",
            title="Nutrition planner agent",
            system_prompt=_nutrition_prompt(style),
            guardrail_rules=rules,
            token_strategy_note=(
                "Send finalized plan summaries, shopping totals, and substitution candidates instead of full recipe corpora."
            ),
            max_context_tokens=max_context_tokens,
            response_token_budget=response_token_budget,
        ),
    ]


def build_ai_settings_response(
    *,
    default_provider: str,
    local_only_mode: bool,
    self_hosted_distribution: bool,
    allow_groq: bool,
    ollama_base_url: str,
    ollama_model: str,
    ollama_embed_model: str,
    ollama_api_key_set: bool,
    groq_model: str,
    groq_api_key_set: bool,
    system_prompt_style: PromptStyle,
    guardrail_level: GuardrailLevel,
    max_context_items: int,
    max_context_tokens: int,
    response_token_budget: int,
) -> AISettings:
    return AISettings(
        default_provider=default_provider,
        local_only_mode=local_only_mode,
        self_hosted_distribution=self_hosted_distribution,
        allow_groq=allow_groq,
        ollama_base_url=ollama_base_url,
        ollama_model=ollama_model,
        ollama_embed_model=ollama_embed_model,
        ollama_api_key_set=ollama_api_key_set,
        groq_model=groq_model,
        groq_api_key_set=groq_api_key_set,
        system_prompt_style=system_prompt_style,
        guardrail_level=guardrail_level,
        max_context_items=max_context_items,
        max_context_tokens=max_context_tokens,
        response_token_budget=response_token_budget,
        device_notice=DEVICE_NOTICE,
        prompt_profiles=build_prompt_profiles(
            style=system_prompt_style,
            guardrail_level=guardrail_level,
            max_context_tokens=max_context_tokens,
            response_token_budget=response_token_budget,
        ),
    )


def _normalize_ollama_base_url(raw_url: str) -> tuple[str, str, bool]:
    candidate = raw_url.strip() or "http://localhost:11434"
    parsed = urlparse(candidate if "://" in candidate else f"http://{candidate}")

    if not parsed.netloc:
        raise ValueError("Enter a valid Ollama base URL, such as http://localhost:11434.")

    sanitized = urlunparse((parsed.scheme or "http", parsed.netloc, "", "", "", "")).rstrip("/")
    hostname = (parsed.hostname or "").lower()
    local_target = hostname in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}

    return sanitized, hostname, local_target


def _ollama_headers(api_key: str | None) -> dict[str, str]:
    headers = {"Accept": "application/json"}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    return headers


def _read_json(url: str, headers: dict[str, str]) -> dict:
    request = Request(url, headers=headers, method="GET")

    with urlopen(request, timeout=3) as response:
        payload = response.read().decode("utf-8")

    return json.loads(payload) if payload else {}


def check_ollama_runtime(
    *,
    ollama_base_url: str,
    ollama_model: str,
    ollama_api_key: str | None,
) -> AIRuntimeHealthCheckResponse:
    target, _hostname, local_target = _normalize_ollama_base_url(ollama_base_url)
    model_name = ollama_model.strip() or None
    headers = _ollama_headers(ollama_api_key.strip() if ollama_api_key else None)

    try:
        version_payload = _read_json(f"{target}/api/version", headers)
        tags_payload = _read_json(f"{target}/api/tags", headers)
    except ValueError as exc:
        raise ValueError("Ollama returned an unreadable response.") from exc
    except HTTPError as exc:
        status_code = exc.code
        if status_code in {401, 403}:
            message = "Ollama responded, but this local runtime rejected the request credentials."
        else:
            message = f"Ollama responded from {target}, but the runtime health check failed with HTTP {status_code}."

        return AIRuntimeHealthCheckResponse(
            ok=False,
            target=target,
            local_target=local_target,
            message=message,
        )
    except (URLError, SocketTimeout):
        locality = "local" if local_target else "configured"
        return AIRuntimeHealthCheckResponse(
            ok=False,
            target=target,
            local_target=local_target,
            message=f"Atlas could not reach the {locality} Ollama runtime at {target}. Make sure Ollama is running on this device and reachable from Atlas.",
        )

    available_models = {
        model.get("model", "").strip()
        for model in tags_payload.get("models", [])
        if isinstance(model, dict)
    }
    model_available = model_name in available_models if model_name else None

    if model_name and model_available is False:
        message = (
            f"Reached Ollama at {target}, but the selected model '{model_name}' is not installed on this runtime."
        )
    else:
        locality = "local" if local_target else "configured"
        message = f"Reached the {locality} Ollama runtime at {target}."

    version = version_payload.get("version")

    return AIRuntimeHealthCheckResponse(
        ok=model_available is not False,
        target=target,
        local_target=local_target,
        message=message,
        version=version if isinstance(version, str) else None,
        model_checked=model_name,
        model_available=model_available,
    )
