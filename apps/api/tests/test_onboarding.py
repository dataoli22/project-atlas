def test_onboarding_defaults_to_incomplete(client):
    response = client.get("/api/v1/app/preferences")

    assert response.status_code == 200
    assert response.json()["has_completed_onboarding"] is False


def test_completing_onboarding_marks_preferences(client):
    response = client.post("/api/v1/app/onboarding/complete")

    assert response.status_code == 200
    assert response.json()["has_completed_onboarding"] is True

    follow_up = client.get("/api/v1/app/preferences")
    assert follow_up.json()["has_completed_onboarding"] is True


def test_routine_preference_update_does_not_reset_onboarding_flag(client):
    client.post("/api/v1/app/onboarding/complete")

    update_response = client.put(
        "/api/v1/app/preferences",
        json={
            "active_feature": "nutrition",
            "enabled_feature_flags": ["nutrition", "endurance"],
            "preferred_platform_density": "compact",
            "shared_locale": "en-IN",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["has_completed_onboarding"] is True
