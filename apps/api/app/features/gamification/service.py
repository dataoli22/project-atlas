from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from app.features.gamification.schemas import (
    AchievementProgress,
    GamificationSummaryResponse,
    StreakSummary,
)
from app.features.shared.services.state import shared_state

# Every achievement here is derived from data Atlas already persists for real reasons (synced
# endurance sessions, meal swaps, plan refreshes) - none of it is a fabricated "daily open" streak
# or engagement metric invented just to gamify. See docs/production-todo.md's gamification entry
# for the research this is based on: positive-only framing, no loss-aversion/streak-shame
# mechanics, no social/leaderboard features (not applicable - Atlas is single-user/local-first).

_HISTORY_LIMIT = 2000


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        pass
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


@dataclass(frozen=True)
class _AchievementDef:
    id: str
    title: str
    description: str
    category: str
    target: float
    # Given the full chronologically-sorted list of (date, running_metric_value) points for this
    # achievement's underlying series, returns the date the metric first reached `target`, or
    # None if not yet reached. Keeps "how do I compute this" localized to each metric series
    # (built once below) instead of re-deriving per achievement.
    series_key: str


def _distinct_dates(sessions: list[dict]) -> list[date]:
    dates: set[date] = set()
    for session in sessions:
        parsed = _parse_date(session.get("start_date"))
        if parsed is not None:
            dates.add(parsed)
    return sorted(dates)


def compute_streak(sessions: list[dict], *, today: date | None = None) -> StreakSummary:
    reference_day = today or datetime.now(timezone.utc).date()
    dates = _distinct_dates(sessions)

    if not dates:
        return StreakSummary(
            current_streak_days=0, longest_streak_days=0, last_active_date=None, active_today=False
        )

    longest = 0
    run = 0
    previous: date | None = None
    for day in dates:
        if previous is not None and (day - previous).days == 1:
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        previous = day

    last_active = dates[-1]
    current = 0
    if (reference_day - last_active).days <= 1:
        cursor = last_active
        date_set = set(dates)
        while cursor in date_set:
            current += 1
            cursor -= timedelta(days=1)

    return StreakSummary(
        current_streak_days=current,
        longest_streak_days=longest,
        last_active_date=last_active.isoformat(),
        active_today=last_active == reference_day,
    )


def _longest_streak_timeline(sessions: list[dict]) -> list[tuple[date, float]]:
    """One point per distinct active date, value = longest streak achieved by that date."""
    dates = _distinct_dates(sessions)
    points: list[tuple[date, float]] = []
    run = 0
    longest = 0
    previous: date | None = None
    for day in dates:
        if previous is not None and (day - previous).days == 1:
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        points.append((day, float(longest)))
        previous = day
    return points


def _cumulative_timeline(dated_values: list[tuple[date | None, float]]) -> list[tuple[date, float]]:
    entries = [(d, v) for d, v in dated_values if d is not None]
    entries.sort(key=lambda item: item[0])
    running = 0.0
    points: list[tuple[date, float]] = []
    for day, value in entries:
        running += value
        points.append((day, running))
    return points


def _distinct_count_timeline(dated_keys: list[tuple[date | None, str]]) -> list[tuple[date, float]]:
    entries = [(d, key) for d, key in dated_keys if d is not None]
    entries.sort(key=lambda item: item[0])
    seen: set[str] = set()
    points: list[tuple[date, float]] = []
    for day, key in entries:
        seen.add(key)
        points.append((day, float(len(seen))))
    return points


def _unlock_date_for_target(timeline: list[tuple[date, float]], target: float) -> tuple[bool, date | None, float]:
    """Returns (unlocked, unlock_date, current_value) - current_value is the timeline's latest
    point (or 0 if the series is empty), used for locked achievements' progress display too."""
    if not timeline:
        return False, None, 0.0
    current_value = timeline[-1][1]
    for day, value in timeline:
        if value >= target:
            return True, day, current_value
    return False, None, current_value


_ACHIEVEMENT_DEFS: list[_AchievementDef] = [
    _AchievementDef("first_session", "First Activity Synced", "Synced your first activity from a connected health app.", "endurance", 1, "session_count"),
    _AchievementDef("ten_sessions", "Building Momentum", "Synced 10 activities.", "endurance", 10, "session_count"),
    _AchievementDef("century_sessions", "Century Club", "Synced 100 activities.", "endurance", 100, "session_count"),
    _AchievementDef("distance_50", "50K Club", "Logged 50 cumulative kilometers across synced activities.", "endurance", 50, "distance_km"),
    _AchievementDef("distance_250", "250K Club", "Logged 250 cumulative kilometers across synced activities.", "endurance", 250, "distance_km"),
    _AchievementDef("week_streak", "One Week Strong", "Reached a 7-day activity streak.", "endurance", 7, "longest_streak"),
    _AchievementDef("month_streak", "Consistency Champion", "Reached a 30-day activity streak.", "endurance", 30, "longest_streak"),
    _AchievementDef("first_swap", "Recipe Explorer", "Swapped your first planned meal.", "nutrition", 1, "swap_count"),
    _AchievementDef("ten_swaps", "Menu Curator", "Swapped 10 planned meals.", "nutrition", 10, "swap_count"),
    _AchievementDef("plan_refresh", "Fresh Start", "Refreshed your nutrition plan.", "nutrition", 1, "refresh_count"),
    _AchievementDef("connected_app", "Linked Up", "Connected and synced a health app for the first time.", "connections", 1, "distinct_sources"),
    _AchievementDef("multi_source", "Multi-Source Athlete", "Synced activity data from 2 or more connected apps.", "connections", 2, "distinct_sources"),
]


def get_gamification_summary(*, today: date | None = None) -> GamificationSummaryResponse:
    sessions = shared_state.query_health_sessions(limit=_HISTORY_LIMIT)
    market_code = shared_state.get_localization().market
    swaps = shared_state.list_meal_swap_history(market_code=market_code, limit=_HISTORY_LIMIT)
    refreshes = shared_state.get_planner_generation_history(limit=_HISTORY_LIMIT)

    streak = compute_streak(sessions, today=today)

    series: dict[str, list[tuple[date, float]]] = {
        "session_count": _cumulative_timeline([(_parse_date(s.get("start_date")), 1.0) for s in sessions]),
        "distance_km": _cumulative_timeline(
            [(_parse_date(s.get("start_date")), float(s.get("distance_km") or 0)) for s in sessions]
        ),
        "longest_streak": _longest_streak_timeline(sessions),
        "swap_count": _cumulative_timeline([(_parse_date(s.get("changed_at")), 1.0) for s in swaps]),
        "refresh_count": _cumulative_timeline([(_parse_date(r.get("generated_at")), 1.0) for r in refreshes]),
        "distinct_sources": _distinct_count_timeline(
            [(_parse_date(s.get("start_date")), str(s.get("source"))) for s in sessions]
        ),
    }

    achievements: list[AchievementProgress] = []
    for definition in _ACHIEVEMENT_DEFS:
        timeline = series[definition.series_key]
        unlocked, unlock_day, current_value = _unlock_date_for_target(timeline, definition.target)
        achievements.append(
            AchievementProgress(
                id=definition.id,
                title=definition.title,
                description=definition.description,
                category=definition.category,
                unlocked=unlocked,
                unlocked_at=unlock_day.isoformat() if unlock_day else None,
                progress_current=min(current_value, definition.target),
                progress_target=definition.target,
            )
        )

    unlocked_count = sum(1 for item in achievements if item.unlocked)
    return GamificationSummaryResponse(
        streak=streak,
        achievements=achievements,
        unlocked_count=unlocked_count,
        total_count=len(achievements),
    )
