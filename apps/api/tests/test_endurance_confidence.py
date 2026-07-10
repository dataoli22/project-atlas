from datetime import datetime, timedelta, timezone

from app.features.endurance.service import _capability_confidence
from app.features.shared.schemas.app import IntegrationSourceStatus


def _fake_integration(key: str, *, last_sync_at: str | None) -> IntegrationSourceStatus:
    return IntegrationSourceStatus(
        key=key,
        title=key,
        connect_mode="oauth",
        connected=True,
        status="connected",
        login_hint="",
        cta_label="",
        doc_url="",
        last_sync_at=last_sync_at,
    )


def test_confidence_is_high_for_a_sync_within_the_last_day(monkeypatch):
    from app.features.endurance import service

    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    synced_at = (now - timedelta(hours=2)).isoformat()

    monkeypatch.setattr(
        service.shared_state,
        "get_integrations",
        lambda: [_fake_integration("strava", last_sync_at=synced_at)],
    )

    confidence, note = _capability_confidence(["strava-live"], now=now)

    assert confidence == "high"
    assert "2h" in note


def test_confidence_is_medium_for_a_sync_two_days_old(monkeypatch):
    from app.features.endurance import service

    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    synced_at = (now - timedelta(hours=48)).isoformat()

    monkeypatch.setattr(
        service.shared_state,
        "get_integrations",
        lambda: [_fake_integration("strava", last_sync_at=synced_at)],
    )

    confidence, note = _capability_confidence(["strava-live"], now=now)

    assert confidence == "medium"
    assert "sync again" in note


def test_confidence_is_low_for_a_sync_over_a_week_old(monkeypatch):
    from app.features.endurance import service

    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    synced_at = (now - timedelta(days=8)).isoformat()

    monkeypatch.setattr(
        service.shared_state,
        "get_integrations",
        lambda: [_fake_integration("strava", last_sync_at=synced_at)],
    )

    confidence, note = _capability_confidence(["strava-live"], now=now)

    assert confidence == "low"
    assert "may not reflect recent training" in note


def test_confidence_uses_the_freshest_of_multiple_sources(monkeypatch):
    from app.features.endurance import service

    now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
    fresh_sync = (now - timedelta(hours=1)).isoformat()
    stale_sync = (now - timedelta(days=10)).isoformat()

    monkeypatch.setattr(
        service.shared_state,
        "get_integrations",
        lambda: [
            _fake_integration("strava", last_sync_at=stale_sync),
            _fake_integration("health_connect", last_sync_at=fresh_sync),
        ],
    )

    confidence, _ = _capability_confidence(["strava-live", "health-connect-live"], now=now)

    assert confidence == "high"


def test_confidence_is_low_when_no_sync_timestamp_is_available(monkeypatch):
    from app.features.endurance import service

    monkeypatch.setattr(
        service.shared_state,
        "get_integrations",
        lambda: [_fake_integration("strava", last_sync_at=None)],
    )

    confidence, note = _capability_confidence(["strava-live"])

    assert confidence == "low"
    assert "isn't available yet" in note
