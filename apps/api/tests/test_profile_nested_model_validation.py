from app.features.shared.schemas.app import ProfileSettingsUpdate
from app.features.shared.schemas.health import BodyWeightMetric, HydrationMetric
from app.features.shared.services.state import shared_state


def test_update_profile_keeps_body_weight_as_a_real_model_not_a_raw_dict():
    """Regression test: model_copy(update=payload.model_dump()) used to assign body_weight as a
    plain dict instead of a validated BodyWeightMetric, silently breaking any code that later
    accessed .value/.unit as attributes (e.g. endurance/service.py's hydration normalization).
    """
    updated = shared_state.update_profile(
        ProfileSettingsUpdate(body_weight=BodyWeightMetric(value=68, unit="kg"))
    )

    assert isinstance(updated.body_weight, BodyWeightMetric)
    assert updated.body_weight.value == 68
    assert updated.body_weight.unit == "kg"

    # Also check the value actually stored on shared state, not just the returned copy.
    stored = shared_state.get_profile()
    assert isinstance(stored.body_weight, BodyWeightMetric)
    assert stored.body_weight.value == 68


def test_update_profile_keeps_hydration_as_a_real_model_not_a_raw_dict():
    updated = shared_state.update_profile(
        ProfileSettingsUpdate(hydration=HydrationMetric(amount=2200, unit="ml"))
    )

    assert isinstance(updated.hydration, HydrationMetric)
    assert updated.hydration.amount == 2200
