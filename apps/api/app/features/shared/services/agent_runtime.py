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
ConfidenceLevel = Literal["high", "medium", "low"]


@dataclass
class AgentExecutionPlan:
    feature: FeatureScope
    provider: Literal["ollama", "groq"]
    model: str
    prompt_title: str
    prompt_version: str
    system_prompt: str
    token_strategy_note: str
    grounding: list[ChatGroundingItem]
    messages: list[dict[str, str]]
    warnings: list[str]
    confidence: ConfidenceLevel
    confidence_reason: str
    connector_freshness: str


def _health_query_grounding(question: str) -> list[ChatGroundingItem]:
    """Real retrieved records (health_sessions/health_metric_readings - see
    endurance/health_query.py) for a specific question like "what was my resting heart rate last
    week", layered on top of the fixed scalar summaries above. Only injects items when the
    question actually matched a metric/date range/session keyword - most questions won't, and
    those get no extra grounding rather than noise."""
    if not question:
        return []

    from app.features.endurance.health_query import query_health_data

    result = query_health_data(question)
    items: list[ChatGroundingItem] = []
    if result.metric_readings:
        readings_text = "; ".join(
            f"{reading['recorded_at'][:10]}: {reading['value']}" for reading in result.metric_readings[:5]
        )
        items.append(ChatGroundingItem(label=f"Recent {result.matched_metric} readings", value=readings_text))
    if result.sessions:
        sessions_text = "; ".join(
            f"{session['start_date'][:10]} {session['session_label']} ({session['source']})"
            for session in result.sessions[:5]
        )
        items.append(ChatGroundingItem(label="Matching synced sessions", value=sessions_text))
    return items


def find_prompt_profile(ai_settings: AISettings, feature: FeatureScope):
    if feature == "shared":
        return next(profile for profile in ai_settings.prompt_profiles if profile.module == "shared")

    return next(profile for profile in ai_settings.prompt_profiles if profile.module == feature)


def grounding_for_feature(feature: FeatureScope, *, question: str = "") -> list[ChatGroundingItem]:
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
            *_health_query_grounding(question),
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


def _connector_status(feature: FeatureScope) -> tuple[ConfidenceLevel, str, str]:
    """Assess how much the plan's grounding rests on real synced data vs. stub/no data.

    Returns (confidence, confidence_reason, connector_freshness) - the explicit signals a
    handoff needs to judge whether an answer is safe to act on. `shared` always reports medium:
    it aggregates both feature domains rather than owning one connector's freshness directly.
    """

    runtime = shared_state.get_integration_runtime_snapshot()
    strava_runtime = runtime["strava"]
    health_connect_runtime = runtime["health_connect"]
    samsung_runtime = runtime["samsung_health"]

    if feature == "endurance":
        strava_count = len(strava_runtime.get("recent_activities") or [])
        if strava_count > 0:
            return (
                "high",
                f"Grounded in {strava_count} synced Strava activities.",
                f"Strava: {strava_count} activities synced.",
            )
        return (
            "low",
            "No Strava activities synced yet; endurance grounding falls back to illustrative stub data.",
            "Strava: not synced.",
        )

    if feature == "nutrition":
        pantry_count = len(shared_state.get_pantry_items())
        connect_sessions = len(health_connect_runtime.get("recent_sessions") or [])
        samsung_sessions = len(samsung_runtime.get("recent_sessions") or [])
        if pantry_count > 0 or connect_sessions > 0 or samsung_sessions > 0:
            return (
                "medium",
                "Nutrition plan is deterministic; some grounding (pantry or connector data) is personalized.",
                f"Pantry: {pantry_count} items. Health Connect: {connect_sessions} sessions. "
                f"Samsung Health: {samsung_sessions} sessions.",
            )
        return (
            "medium",
            "Nutrition plan is deterministic and blueprint-based; no personalization data synced yet.",
            "No nutrition connector data synced.",
        )

    connected_count = sum(
        1
        for runtime_snapshot in (strava_runtime, health_connect_runtime, samsung_runtime)
        if runtime_snapshot.get("recent_activities") or runtime_snapshot.get("recent_sessions")
    )
    if connected_count > 0:
        return (
            "medium",
            f"{connected_count} connector(s) have synced data available to either feature agent.",
            f"{connected_count} connector(s) with synced data.",
        )
    return (
        "low",
        "No connectors have synced data yet; shared answers stay generic across both feature domains.",
        "No connectors synced.",
    )


def build_execution_plan(
    *,
    feature: FeatureScope,
    question: str,
    history: list[ChatMessageRequest],
    ai_settings: AISettings,
) -> AgentExecutionPlan:
    prompt_profile = find_prompt_profile(ai_settings, feature)
    grounding = grounding_for_feature(feature, question=question)
    confidence, confidence_reason, connector_freshness = _connector_status(feature)
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
                f"Data confidence: {confidence} ({confidence_reason})\n"
                f"Connector freshness: {connector_freshness}\n"
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
        prompt_version=prompt_profile.prompt_version,
        system_prompt=prompt_profile.system_prompt,
        token_strategy_note=prompt_profile.token_strategy_note,
        grounding=grounding,
        messages=messages,
        warnings=warnings,
        confidence=confidence,
        confidence_reason=confidence_reason,
        connector_freshness=connector_freshness,
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
