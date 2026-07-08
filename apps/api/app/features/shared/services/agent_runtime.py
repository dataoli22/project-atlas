from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.features.endurance.service import get_stub_dashboard, get_stub_insights, get_stub_timeline
from app.features.nutrition.service import (
    get_nutrition_cooking_plan,
    get_nutrition_planner,
    get_nutrition_shopping_list,
    get_nutrition_substitutions,
)
from app.features.shared.schemas.app import AISettings, ChatGroundingItem, ChatMessageRequest
from app.features.shared.services.state import shared_state


FeatureScope = Literal["shared", "endurance", "nutrition"]


@dataclass
class AgentExecutionPlan:
    feature: FeatureScope
    provider: Literal["ollama", "groq"]
    model: str
    prompt_title: str
    system_prompt: str
    token_strategy_note: str
    grounding: list[ChatGroundingItem]
    messages: list[dict[str, str]]
    warnings: list[str]


def find_prompt_profile(ai_settings: AISettings, feature: FeatureScope):
    if feature == "shared":
        return next(profile for profile in ai_settings.prompt_profiles if profile.module == "shared")

    return next(profile for profile in ai_settings.prompt_profiles if profile.module == feature)


def grounding_for_feature(feature: FeatureScope) -> list[ChatGroundingItem]:
    integrations = shared_state.get_integrations()
    runtime = shared_state.get_integration_runtime_snapshot()
    connected_titles = [item.title for item in integrations if item.connected]
    connected_summary = ", ".join(connected_titles) if connected_titles else "None connected"
    strava_runtime = runtime["strava"]
    health_connect_runtime = runtime["health_connect"]
    samsung_runtime = runtime["samsung_health"]

    if feature == "endurance":
        dashboard = get_stub_dashboard()
        timeline = get_stub_timeline()
        insights = get_stub_insights()
        if "recent_activities" in strava_runtime and strava_runtime.get("recent_activities"):
            from app.features.endurance.service import (
                get_endurance_dashboard,
                get_endurance_insights,
                get_endurance_timeline,
            )

            dashboard = get_endurance_dashboard()
            timeline = get_endurance_timeline()
            insights = get_endurance_insights()
        return [
            ChatGroundingItem(label="Capability score", value=dashboard.cards[0].value),
            ChatGroundingItem(label="Latest workout", value=dashboard.latest_workout.title),
            ChatGroundingItem(label="Timeline entries", value=str(len(timeline.entries))),
            ChatGroundingItem(label="Priority insight", value=insights.insights[0].title),
            ChatGroundingItem(label="Connected sources", value=connected_summary),
            ChatGroundingItem(
                label="Strava OAuth state",
                value="Access token ready"
                if strava_runtime.get("access_token_set")
                else "Authorization code captured"
                if strava_runtime.get("token_exchange_ready")
                else "Connected without code"
                if any(item.key == "strava" and item.connected for item in integrations)
                else "Not connected",
            ),
            ChatGroundingItem(
                label="Strava token status",
                value="Authorization code captured"
                if strava_runtime.get("token_exchange_ready")
                else "Local token available"
                if strava_runtime.get("access_token_set")
                else "Pending",
            ),
            ChatGroundingItem(
                label="Strava synced activities",
                value=str(len(strava_runtime.get("recent_activities") or [])),
            ),
            ChatGroundingItem(
                label="Health Connect sessions",
                value=str(len(health_connect_runtime.get("recent_sessions") or [])),
            ),
            ChatGroundingItem(
                label="Health Connect recovery inputs",
                value=(
                    f"{health_connect_runtime.get('hydration_ml') or 'n/a'} ml hydration, "
                    f"{health_connect_runtime.get('step_count') or 'n/a'} steps"
                ),
            ),
            ChatGroundingItem(
                label="Samsung Health sessions",
                value=str(len(samsung_runtime.get("recent_sessions") or [])),
            ),
            ChatGroundingItem(
                label="Samsung recovery inputs",
                value=(
                    f"{samsung_runtime.get('sleep_hours') or 'n/a'} h sleep, "
                    f"energy {samsung_runtime.get('energy_score') or 'n/a'}"
                ),
            ),
        ]

    if feature == "nutrition":
        planner = get_nutrition_planner()
        shopping = get_nutrition_shopping_list()
        substitutions = get_nutrition_substitutions()
        cooking = get_nutrition_cooking_plan()
        return [
            ChatGroundingItem(label="Plan week", value=planner.week_label),
            ChatGroundingItem(label="Projected spend", value=planner.projected_spend),
            ChatGroundingItem(label="Currency code", value=planner.currency_code),
            ChatGroundingItem(label="Cooking cadence", value=planner.cooking_cadence),
            ChatGroundingItem(label="Shopping items", value=str(shopping.total_items)),
            ChatGroundingItem(label="Batch day", value=cooking.batch_day),
            ChatGroundingItem(label="Primary substitution", value=substitutions.substitutions[0].ingredient),
        ]

    return [
        ChatGroundingItem(label="Active modules", value="Endurance and Nutrition"),
        ChatGroundingItem(label="Routing mode", value="Feature-aware local chat"),
        ChatGroundingItem(label="AI runtime", value="Local-first Atlas"),
        ChatGroundingItem(label="Connected sources", value=connected_summary),
    ]


def build_execution_plan(
    *,
    feature: FeatureScope,
    question: str,
    history: list[ChatMessageRequest],
    ai_settings: AISettings,
) -> AgentExecutionPlan:
    prompt_profile = find_prompt_profile(ai_settings, feature)
    grounding = grounding_for_feature(feature)
    provider: Literal["ollama", "groq"] = ai_settings.default_provider
    model = ai_settings.ollama_model if provider == "ollama" else ai_settings.groq_model
    warnings: list[str] = []

    retained_history = history[-ai_settings.max_context_items :]
    if len(history) > len(retained_history):
        warnings.append(
            f"Atlas trimmed conversation history from {len(history)} to {len(retained_history)} turns to stay token-lean."
        )

    grounding_lines = "\n".join(f"- {item.label}: {item.value}" for item in grounding)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": prompt_profile.system_prompt},
        {
            "role": "system",
            "content": (
                f"Feature scope: {feature}\n"
                f"Max context tokens: {ai_settings.max_context_tokens}\n"
                f"Response token budget: {ai_settings.response_token_budget}\n"
                f"Approved grounding:\n{grounding_lines}"
            ),
        },
    ]
    messages.extend({"role": item.role, "content": item.content} for item in retained_history)
    messages.append({"role": "user", "content": question})

    return AgentExecutionPlan(
        feature=feature,
        provider=provider,
        model=model,
        prompt_title=prompt_profile.title,
        system_prompt=prompt_profile.system_prompt,
        token_strategy_note=prompt_profile.token_strategy_note,
        grounding=grounding,
        messages=messages,
        warnings=warnings,
    )


def fallback_answer(feature: FeatureScope, question: str, grounding: list[ChatGroundingItem]) -> str:
    if feature == "endurance":
        return (
            f"Based on the current endurance metrics, the main story is stable progression with a need to protect recovery. "
            f"Your latest question was: '{question}'. Start with the priority signal '{grounding[-1].value}', then review "
            f"the latest workout and capability score before changing load."
        )

    if feature == "nutrition":
        return (
            f"Based on the current nutrition plan, the safest answer is to keep the weekly plan low-friction and cost-aware. "
            f"Your latest question was: '{question}'. Start from the projected spend, then inspect the shopping list and top substitution."
        )

    return (
        f"Atlas is running in local-first shared mode. Your question was: '{question}'. "
        f"Pick the feature with the strongest relevant data, keep deterministic metrics in view, and use the local runtime settings "
        f"to stay token-lean and privacy-preserving."
    )
