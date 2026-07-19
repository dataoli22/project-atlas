from datetime import datetime, timedelta, timezone

from app.features.shared.services.state import shared_state


def _set_strava_activities(activities: list[dict]) -> None:
    with shared_state._lock:
        shared_state._integration_runtime["strava"]["recent_activities"] = [
            {"source": "strava-live", **item} for item in activities
        ]


def test_a_training_plan_has_no_goal_until_one_is_set(client):
    response = client.get("/api/v1/endurance/training-plan")
    payload = response.json()
    assert payload["has_goal"] is False
    assert payload["weeks"] == []


def test_goal_round_trip_via_api(client):
    initial = client.get("/api/v1/endurance/goal").json()
    assert initial["is_set"] is False

    response = client.post(
        "/api/v1/endurance/goal",
        json={
            "goal_type": "sprint_triathlon",
            "target_distance_km": 25.75,
            "target_time_minutes": 90,
            "target_date": "2026-09-01",
            "note": "First triathlon",
        },
    )
    assert response.status_code == 200
    saved = response.json()
    assert saved["is_set"] is True
    assert saved["goal_type"] == "sprint_triathlon"
    assert saved["target_distance_km"] == 25.75
    assert saved["note"] == "First triathlon"

    fetched = client.get("/api/v1/endurance/goal").json()
    assert fetched["goal_type"] == "sprint_triathlon"
    assert fetched["is_set"] is True


def test_goal_rejects_unknown_goal_type(client):
    response = client.post(
        "/api/v1/endurance/goal",
        json={"goal_type": "not_a_real_goal", "target_distance_km": 10},
    )
    assert response.status_code == 400


def test_discipline_kpi_split_groups_real_sessions_by_sport_type(client):
    now = datetime.now(timezone.utc)
    _set_strava_activities(
        [
            {
                "name": "Morning run",
                "sport_type": "Run",
                "moving_time_seconds": 1800,
                "distance_meters": 5000,
                "start_date": (now - timedelta(days=1)).isoformat(),
            },
            {
                "name": "Evening ride",
                "sport_type": "Ride",
                "moving_time_seconds": 3600,
                "distance_meters": 20000,
                "start_date": (now - timedelta(days=2)).isoformat(),
            },
            {
                "name": "Pool swim",
                "sport_type": "Swim",
                "moving_time_seconds": 1200,
                "distance_meters": 1000,
                "start_date": (now - timedelta(days=3)).isoformat(),
            },
        ]
    )

    response = client.get("/api/v1/endurance/kpis/discipline-split")
    assert response.status_code == 200
    payload = response.json()
    assert payload["has_real_sessions"] is True
    disciplines = {row["discipline"] for row in payload["week"]}
    assert {"run", "bike", "swim"}.issubset(disciplines)

    run_row = next(row for row in payload["week"] if row["discipline"] == "run")
    assert run_row["total_distance_km"] == 5.0
    assert run_row["session_count"] == 1


def test_discipline_kpi_split_omits_disciplines_with_no_sessions(client):
    _set_strava_activities([])
    response = client.get("/api/v1/endurance/kpis/discipline-split")
    payload = response.json()
    assert payload["has_real_sessions"] is False
    assert payload["week"] == []
    assert payload["month"] == []


def test_weekly_volume_trend_reflects_real_synced_sessions(client):
    now = datetime.now(timezone.utc)
    _set_strava_activities(
        [
            {
                "name": "Long run",
                "sport_type": "Run",
                "moving_time_seconds": 3600,
                "distance_meters": 10000,
                "start_date": (now - timedelta(days=2)).isoformat(),
            }
        ]
    )
    response = client.get("/api/v1/endurance/kpis/weekly-volume")
    assert response.status_code == 200
    payload = response.json()
    assert payload["has_real_sessions"] is True
    assert len(payload["weeks"]) == 1
    assert payload["weeks"][0]["total_distance_km"] == 10.0


def test_training_plan_builds_weeks_from_a_real_goal(client):
    client.post(
        "/api/v1/endurance/goal",
        json={"goal_type": "5k_run", "target_distance_km": 5},
    )
    response = client.get("/api/v1/endurance/training-plan")
    assert response.status_code == 200
    payload = response.json()
    assert payload["has_goal"] is True
    assert len(payload["weeks"]) == 6
    assert payload["sessions_by_discipline"][0]["discipline"] == "run"
    # Weekly volume should trend upward (10% rule) until the taper week.
    totals = [week["total_distance_km"] for week in payload["weeks"]]
    assert totals[1] >= totals[0]


def test_training_plan_uses_triathlon_sessions_for_triathlon_goal(client):
    client.post(
        "/api/v1/endurance/goal",
        json={"goal_type": "sprint_triathlon", "target_distance_km": 25.75},
    )
    response = client.get("/api/v1/endurance/training-plan")
    disciplines = {row["discipline"] for row in response.json()["sessions_by_discipline"]}
    assert disciplines == {"swim", "bike", "run"}
