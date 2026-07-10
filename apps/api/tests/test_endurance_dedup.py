from app.features.endurance.service import _combined_recent_sessions, _dedupe_cross_source_sessions


def test_dedupe_collapses_the_same_workout_reported_by_two_sources():
    sessions = [
        {
            "name": "Morning Run",
            "start_date": "2026-07-09T06:00:00Z",
            "moving_time_seconds": 3600,
            "source": "strava-live",
        },
        {
            "session_label": "Health Connect steady run",
            "start_date": "2026-07-09T06:01:00Z",  # same minute-ish, different precision
            "duration_minutes": 61,  # same 5-minute bucket as 3600s
            "source": "health-connect-live",
        },
    ]

    deduped = _dedupe_cross_source_sessions(sessions)

    assert len(deduped) == 1
    # First-wins: Strava's richer record is kept over the coarser Health Connect one.
    assert deduped[0]["source"] == "strava-live"


def test_dedupe_keeps_genuinely_distinct_sessions():
    sessions = [
        {"name": "Morning Run", "start_date": "2026-07-09T06:00:00Z", "moving_time_seconds": 3600, "source": "strava-live"},
        {"name": "Evening Walk", "start_date": "2026-07-09T19:00:00Z", "moving_time_seconds": 1800, "source": "strava-live"},
    ]

    deduped = _dedupe_cross_source_sessions(sessions)

    assert len(deduped) == 2


def test_dedupe_does_not_collapse_same_start_time_but_very_different_duration():
    sessions = [
        {"name": "Quick jog", "start_date": "2026-07-09T06:00:00Z", "moving_time_seconds": 600, "source": "strava-live"},
        {"name": "Long run", "start_date": "2026-07-09T06:00:00Z", "moving_time_seconds": 5400, "source": "health-connect-live"},
    ]

    deduped = _dedupe_cross_source_sessions(sessions)

    assert len(deduped) == 2


def test_combined_recent_sessions_dedupes_across_all_three_connector_runtimes():
    runtime = {
        "strava": {
            "recent_activities": [
                {
                    "name": "Morning Run",
                    "start_date": "2026-07-09T06:00:00Z",
                    "moving_time_seconds": 3600,
                    "distance_meters": 10000.0,
                    "source": "strava-live",
                }
            ]
        },
        "health_connect": {
            "recent_sessions": [
                {
                    "session_label": "Health Connect steady run",
                    "session_type": "Run",
                    "duration_minutes": 60,
                    "distance_km": 10.0,
                    "start_date": "2026-07-09T06:00:30Z",
                    "source": "health-connect-live",
                }
            ]
        },
        "samsung_health": {"recent_sessions": []},
    }

    combined = _combined_recent_sessions(runtime)

    assert len(combined) == 1
    assert combined[0]["source"] == "strava-live"
