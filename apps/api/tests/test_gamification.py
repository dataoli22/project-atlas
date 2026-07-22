from datetime import date

import pytest

from app.features.gamification.service import compute_streak
from app.features.shared.services.state import shared_state


@pytest.fixture(autouse=True)
def _clear_health_sessions():
    # conftest's restore_shared_state fixture snapshots/restores shared_state's in-memory attrs
    # per test, but health_sessions is a real SQLite table shared across the whole pytest session
    # (see docs/production-todo.md's noted gap on this) - other suites (endurance) write real rows
    # into it, which would otherwise silently pollute achievement/streak counts here depending on
    # test run order. Cleared before every test in this file so counts are always exact.
    if shared_state._db is not None:
        with shared_state._db._transaction() as connection:
            connection.execute("DELETE FROM health_sessions")
    yield


def _session(*, day: str, distance_km: float = 5.0, source: str = "strava", label: str = "run") -> dict:
    return {"start_date": day, "distance_km": distance_km, "session_type": "run", "session_label": label}


def test_empty_history_has_no_streak_and_no_unlocked_achievements():
    streak = compute_streak([], today=date(2026, 7, 20))
    assert streak.current_streak_days == 0
    assert streak.longest_streak_days == 0
    assert streak.last_active_date is None
    assert streak.active_today is False


def test_streak_counts_consecutive_days_ending_today():
    sessions = [_session(day="2026-07-18"), _session(day="2026-07-19"), _session(day="2026-07-20")]
    streak = compute_streak(sessions, today=date(2026, 7, 20))
    assert streak.current_streak_days == 3
    assert streak.longest_streak_days == 3
    assert streak.active_today is True


def test_streak_still_counts_when_last_session_was_yesterday():
    sessions = [_session(day="2026-07-18"), _session(day="2026-07-19")]
    streak = compute_streak(sessions, today=date(2026, 7, 20))
    assert streak.current_streak_days == 2
    assert streak.active_today is False


def test_streak_breaks_after_a_missed_day():
    sessions = [_session(day="2026-07-15"), _session(day="2026-07-16"), _session(day="2026-07-19")]
    streak = compute_streak(sessions, today=date(2026, 7, 22))
    # last activity was 3 days ago - the current streak is broken, but the earlier 2-day run is
    # still reflected in longest_streak_days.
    assert streak.current_streak_days == 0
    assert streak.longest_streak_days == 2


def test_longest_streak_survives_a_broken_current_streak():
    sessions = [
        _session(day="2026-07-01"),
        _session(day="2026-07-02"),
        _session(day="2026-07-03"),
        _session(day="2026-07-04"),
        _session(day="2026-07-19"),
    ]
    streak = compute_streak(sessions, today=date(2026, 7, 22))
    assert streak.longest_streak_days == 4
    assert streak.current_streak_days == 0


def test_multiple_sessions_same_day_count_once_toward_streak():
    sessions = [_session(day="2026-07-20", label="morning"), _session(day="2026-07-20", label="evening")]
    streak = compute_streak(sessions, today=date(2026, 7, 20))
    assert streak.current_streak_days == 1


def test_unparseable_dates_are_skipped_not_crashed_on():
    streak = compute_streak([{"start_date": "not-a-date"}], today=date(2026, 7, 20))
    assert streak.current_streak_days == 0


def test_summary_unlocks_first_session_achievement_after_one_real_sync(client):
    shared_state.record_health_sessions(source="strava", sessions=[_session(day="2026-07-20")])

    response = client.get("/api/v1/gamification/summary")
    assert response.status_code == 200
    body = response.json()

    first_session = next(a for a in body["achievements"] if a["id"] == "first_session")
    assert first_session["unlocked"] is True
    assert first_session["unlocked_at"] == "2026-07-20"

    ten_sessions = next(a for a in body["achievements"] if a["id"] == "ten_sessions")
    assert ten_sessions["unlocked"] is False
    assert ten_sessions["progress_current"] == 1
    assert ten_sessions["progress_target"] == 10


def test_summary_unlocks_multi_source_after_two_distinct_connectors(client):
    shared_state.record_health_sessions(source="strava", sessions=[_session(day="2026-07-18", source="strava")])
    shared_state.record_health_sessions(
        source="health_connect", sessions=[_session(day="2026-07-19", source="health_connect")]
    )

    response = client.get("/api/v1/gamification/summary")
    body = response.json()

    multi_source = next(a for a in body["achievements"] if a["id"] == "multi_source")
    assert multi_source["unlocked"] is True


def test_summary_counts_distance_achievement_across_sessions(client):
    shared_state.record_health_sessions(
        source="strava",
        sessions=[
            _session(day="2026-07-01", distance_km=20, label="a"),
            _session(day="2026-07-02", distance_km=35, label="b"),
        ],
    )

    response = client.get("/api/v1/gamification/summary")
    body = response.json()

    distance_50 = next(a for a in body["achievements"] if a["id"] == "distance_50")
    assert distance_50["unlocked"] is True
    assert distance_50["unlocked_at"] == "2026-07-02"


def test_summary_reports_unlocked_and_total_counts_consistently(client):
    response = client.get("/api/v1/gamification/summary")
    body = response.json()
    assert body["total_count"] == len(body["achievements"])
    assert body["unlocked_count"] == sum(1 for a in body["achievements"] if a["unlocked"])
