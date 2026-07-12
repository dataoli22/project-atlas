from datetime import datetime, timezone

from app.features.shared.services.state import shared_state


def test_device_sync_persists_sessions_to_permanent_history(client):
    today = datetime.now(timezone.utc).date().isoformat()
    response = client.post(
        "/api/v1/integrations/health_connect/device-sync",
        json={
            "device_label": "Pixel 10 Pro",
            "bridge_source": "health-connect-sdk",
            "recent_sessions": [
                {
                    "session_label": "Evening run",
                    "session_type": "Run",
                    "duration_minutes": 40,
                    "distance_km": 7.0,
                    "start_date": f"{today}T18:00:00Z",
                    "source": "health-connect-live",
                }
            ],
            "hydration_ml": 2200,
            "step_count": 9000,
        },
    )
    assert response.status_code == 200

    query_response = client.get("/api/v1/endurance/query", params={"question": "what sessions did I do today"})
    assert query_response.status_code == 200
    payload = query_response.json()
    assert any(session["session_label"] == "Evening run" for session in payload["sessions"])


def test_second_sync_does_not_erase_first_syncs_session_history():
    # Directly against the state/DB layer rather than the NL query endpoint - that layer only
    # does simple relative-keyword matching (today/this week/etc, not literal "since <date>"
    # phrases), and its default result limit ranks by recency, which the DB-wide cross-test-run
    # accumulation documented in production-todo.md could otherwise push these fixed-past-date
    # rows out of. Querying with an explicit since= argument is what actually verifies retention.
    day_one = "2026-01-01T18:00:00Z"
    day_two = "2026-01-02T18:00:00Z"
    unique_label_one = "Retention test day one run"
    unique_label_two = "Retention test day two walk"

    shared_state.record_health_sessions(
        source="health_connect",
        sessions=[
            {
                "session_label": unique_label_one,
                "session_type": "Run",
                "duration_minutes": 30,
                "start_date": day_one,
            }
        ],
    )
    shared_state.record_health_sessions(
        source="health_connect",
        sessions=[
            {
                "session_label": unique_label_two,
                "session_type": "Walk",
                "duration_minutes": 20,
                "start_date": day_two,
            }
        ],
    )

    results = shared_state.query_health_sessions(since="2026-01-01", until="2026-01-03", limit=50)
    labels = {session["session_label"] for session in results}
    # Both syncs' sessions are retained - previously the second sync would have overwritten the
    # first sync's recent_sessions list entirely (state.py's old `recent_sessions = recent_sessions`).
    assert unique_label_one in labels
    assert unique_label_two in labels


def test_metric_query_matches_keyword_and_returns_real_readings(client):
    client.post(
        "/api/v1/integrations/samsung_health/device-sync",
        json={
            "device_label": "Galaxy Watch",
            "bridge_source": "samsung-health-sdk",
            "recent_sessions": [],
            "sleep_hours": 7.2,
            "resting_hr": 54,
        },
    )

    response = client.get("/api/v1/endurance/query", params={"question": "how many hours did I sleep"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["matched_metric"] == "sleep_hours"
    assert any(reading["value"] == 7.2 for reading in payload["metric_readings"])


def test_query_with_no_matching_keywords_returns_empty_results(client):
    response = client.get("/api/v1/endurance/query", params={"question": "hello atlas"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["matched_metric"] is None
    assert payload["sessions"] == []
    assert payload["metric_readings"] == []
