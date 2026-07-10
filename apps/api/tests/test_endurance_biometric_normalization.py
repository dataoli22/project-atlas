from app.features.endurance.service import (
    _hydration_target_ml,
    _normalize_hydration_score,
    _normalize_sleep_score,
    _normalized_recovery_score,
)


def test_hydration_target_falls_back_to_default_without_a_body_weight_profile(monkeypatch):
    from app.features.endurance import service
    from app.features.shared.schemas.app import ProfileSettings

    monkeypatch.setattr(
        service.shared_state,
        "get_profile",
        lambda: ProfileSettings(body_weight=None),
    )

    assert _hydration_target_ml() == 2500.0


def test_hydration_target_scales_with_recorded_body_weight_in_kg(monkeypatch):
    from app.features.endurance import service
    from app.features.shared.schemas.app import ProfileSettings
    from app.features.shared.schemas.health import BodyWeightMetric

    monkeypatch.setattr(
        service.shared_state,
        "get_profile",
        lambda: ProfileSettings(body_weight=BodyWeightMetric(value=80, unit="kg")),
    )

    assert _hydration_target_ml() == 80 * 35.0


def test_hydration_target_converts_pounds_to_kg(monkeypatch):
    from app.features.endurance import service
    from app.features.shared.schemas.app import ProfileSettings
    from app.features.shared.schemas.health import BodyWeightMetric

    monkeypatch.setattr(
        service.shared_state,
        "get_profile",
        lambda: ProfileSettings(body_weight=BodyWeightMetric(value=176, unit="lb")),
    )

    target = _hydration_target_ml()

    assert 2790 < target < 2800  # ~176lb -> ~79.8kg -> ~2793ml


def test_normalize_hydration_score_full_credit_at_target():
    assert _normalize_hydration_score(2500, target_ml=2500) == 100


def test_normalize_hydration_score_caps_at_130_percent_of_target():
    assert _normalize_hydration_score(10000, target_ml=2500) == 100


def test_normalize_hydration_score_partial_credit_below_target():
    assert _normalize_hydration_score(1250, target_ml=2500) == 50


def test_normalize_hydration_score_zero_without_data():
    assert _normalize_hydration_score(None, target_ml=2500) == 0


def test_normalize_sleep_score_full_credit_within_target_band():
    assert _normalize_sleep_score(8.0) == 100
    assert _normalize_sleep_score(7.0) == 100
    assert _normalize_sleep_score(9.0) == 100


def test_normalize_sleep_score_penalizes_undersleeping():
    assert _normalize_sleep_score(5.0) == 60  # 2h deficit * 20 = 40 off 100
    assert _normalize_sleep_score(0.0) == 0


def test_normalize_sleep_score_penalizes_oversleeping_less_steeply():
    assert _normalize_sleep_score(11.0) == 80  # 2h excess * 10 = 20 off 100


def test_normalized_recovery_score_averages_hydration_and_sleep():
    # hydration at target (100) + sleep in-band (100) -> average 100
    score = _normalized_recovery_score(2500, 8.0)
    assert score == 100


def test_normalized_recovery_score_uses_whichever_signal_is_available():
    assert _normalized_recovery_score(None, 8.0) == 100
    assert _normalized_recovery_score(2500, None) == 100


def test_normalized_recovery_score_falls_back_to_baseline_with_no_data():
    assert _normalized_recovery_score(None, None) == 45
