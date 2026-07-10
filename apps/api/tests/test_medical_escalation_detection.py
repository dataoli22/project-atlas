from app.features.endurance.medical_escalation import (
    ELEVATED_RESTING_HR_THRESHOLD_BPM,
    SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS,
    detect_medical_red_flags,
)


def test_no_flags_with_no_data():
    assert detect_medical_red_flags(resting_hr=None, sleep_hours=None) == []


def test_no_flags_with_normal_values():
    flags = detect_medical_red_flags(resting_hr=58, sleep_hours=7.5)

    assert flags == []


def test_flags_elevated_resting_heart_rate_at_threshold():
    flags = detect_medical_red_flags(resting_hr=ELEVATED_RESTING_HR_THRESHOLD_BPM, sleep_hours=None)

    assert len(flags) == 1
    assert flags[0].flag_type == "elevated_resting_heart_rate"
    assert flags[0].severity == "high"


def test_does_not_flag_resting_heart_rate_just_below_threshold():
    flags = detect_medical_red_flags(resting_hr=ELEVATED_RESTING_HR_THRESHOLD_BPM - 1, sleep_hours=None)

    assert flags == []


def test_does_not_flag_low_resting_heart_rate():
    """Deliberate: endurance athletes routinely have resting HR well below general-population
    "normal" - flagging low values would false-positive on this app's actual audience."""
    flags = detect_medical_red_flags(resting_hr=38, sleep_hours=None)

    assert flags == []


def test_flags_severe_sleep_deprivation_at_threshold():
    flags = detect_medical_red_flags(resting_hr=None, sleep_hours=SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS)

    assert len(flags) == 1
    assert flags[0].flag_type == "severe_sleep_deprivation"
    assert flags[0].severity == "medium"


def test_does_not_flag_sleep_just_above_threshold():
    flags = detect_medical_red_flags(resting_hr=None, sleep_hours=SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS + 0.5)

    assert flags == []


def test_flags_both_conditions_simultaneously():
    flags = detect_medical_red_flags(resting_hr=105, sleep_hours=2.0)

    flag_types = {flag.flag_type for flag in flags}
    assert flag_types == {"elevated_resting_heart_rate", "severe_sleep_deprivation"}


def test_each_flag_detail_names_the_actual_number():
    flags = detect_medical_red_flags(resting_hr=112, sleep_hours=1.5)

    hr_flag = next(f for f in flags if f.flag_type == "elevated_resting_heart_rate")
    sleep_flag = next(f for f in flags if f.flag_type == "severe_sleep_deprivation")
    assert "112" in hr_flag.detail
    assert "1.5" in sleep_flag.detail
