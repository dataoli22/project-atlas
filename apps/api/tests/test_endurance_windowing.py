from datetime import datetime, timedelta, timezone

from app.features.endurance.service import (
    CAPABILITY_WINDOW_DAYS,
    _capability_score_from_activities,
    _recency_weight,
)


def _session(*, hours_ago: float, duration_seconds: int, now: datetime) -> dict:
    start = now - timedelta(hours=hours_ago)
    return {"start_date": start.isoformat(), "moving_time_seconds": duration_seconds}


def test_a_session_from_today_gets_full_weight():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    session = _session(hours_ago=2, duration_seconds=3600, now=now)

    assert _recency_weight(session, now=now) == 1.0


def test_a_session_at_the_window_edge_gets_the_floor_weight():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    session = _session(hours_ago=CAPABILITY_WINDOW_DAYS * 24, duration_seconds=3600, now=now)

    assert _recency_weight(session, now=now) == 0.15


def test_a_session_beyond_the_window_stays_at_the_floor_not_zero():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    session = _session(hours_ago=(CAPABILITY_WINDOW_DAYS + 30) * 24, duration_seconds=3600, now=now)

    assert _recency_weight(session, now=now) == 0.15


def test_weight_decays_monotonically_between_the_edges():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    three_days = _session(hours_ago=72, duration_seconds=3600, now=now)
    ten_days = _session(hours_ago=240, duration_seconds=3600, now=now)

    weight_3d = _recency_weight(three_days, now=now)
    weight_10d = _recency_weight(ten_days, now=now)

    assert 0.15 < weight_10d < weight_3d < 1.0


def test_a_session_with_an_unparseable_date_is_not_penalized():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    session = {"start_date": "not-a-date", "moving_time_seconds": 3600}

    assert _recency_weight(session, now=now) == 1.0


def test_capability_score_favors_recent_sessions_over_old_ones_with_equal_volume():
    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    recent_heavy = [_session(hours_ago=1, duration_seconds=7200, now=now)]
    old_heavy = [_session(hours_ago=(CAPABILITY_WINDOW_DAYS + 5) * 24, duration_seconds=7200, now=now)]

    recent_score = _capability_score_from_activities(recent_heavy, now=now)
    old_score = _capability_score_from_activities(old_heavy, now=now)

    assert recent_score > old_score
