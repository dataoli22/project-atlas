from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.features.shared.services.state import shared_state

_KNOWN_METRICS = (
    "hydration_ml",
    "body_weight_kg",
    "step_count",
    "active_energy_kcal",
    "sleep_hours",
    "resting_hr",
    "energy_score",
    "stress_level",
)

_METRIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "hydration_ml": ("hydration", "water intake", "drank"),
    "body_weight_kg": ("weight", "body weight"),
    "step_count": ("steps", "step count", "walked"),
    "active_energy_kcal": ("active energy", "calories burned", "kcal"),
    "sleep_hours": ("sleep", "slept"),
    "resting_hr": ("resting heart rate", "resting hr", "heart rate"),
    "energy_score": ("energy score",),
    "stress_level": ("stress",),
}

_RELATIVE_RANGE_KEYWORDS = {
    "today": 1,
    "yesterday": 2,
    "this week": 7,
    "last week": 14,
    "past week": 7,
    "this month": 31,
    "last month": 62,
    "past month": 31,
}


@dataclass(frozen=True)
class HealthQueryResult:
    matched_metric: str | None
    sessions: list[dict]
    metric_readings: list[dict]


def query_health_data(question: str, *, limit: int = 10) -> HealthQueryResult:
    """Structured retrieval over real synced health/fitness history (health_sessions,
    health_metric_readings - see shared/services/db.py's migration 004), grounding Ask Atlas
    answers and dashboard queries in actual records instead of the fixed scalar summaries
    agent_runtime.py previously injected. Deliberately keyword/date-range matching, not an LLM
    call or embedding search - these are small, well-structured numeric/dated records where exact
    filtering finds the right rows more reliably (and far cheaper) than semantic retrieval would.
    """
    lowered = question.lower()
    since = _resolve_since(lowered)
    matched_metric = _match_metric(lowered)

    sessions = shared_state.query_health_sessions(since=since, limit=limit) if _mentions_sessions(lowered) else []
    metric_readings = (
        shared_state.query_health_metric_history(metric_name=matched_metric, since=since, limit=limit)
        if matched_metric
        else []
    )
    return HealthQueryResult(matched_metric=matched_metric, sessions=sessions, metric_readings=metric_readings)


def _resolve_since(lowered_question: str) -> str | None:
    for phrase, days_back in _RELATIVE_RANGE_KEYWORDS.items():
        if phrase in lowered_question:
            since_date = datetime.now(timezone.utc) - timedelta(days=days_back)
            return since_date.date().isoformat()
    return None


def _match_metric(lowered_question: str) -> str | None:
    for metric_name, keywords in _METRIC_KEYWORDS.items():
        if any(keyword in lowered_question for keyword in keywords):
            return metric_name
    return None


_SESSION_KEYWORDS = ("session", "workout", "run", "walk", "exercise", "activity", "training")


def _mentions_sessions(lowered_question: str) -> bool:
    return any(re.search(rf"\b{re.escape(keyword)}", lowered_question) for keyword in _SESSION_KEYWORDS)
