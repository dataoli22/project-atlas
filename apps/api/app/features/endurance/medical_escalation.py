"""Medical red-flag detection for the endurance module.

The copy in ESCALATION_COPY was reviewed and approved by the product owner and is now
wired into EnduranceInsightsResponse.medical_flags (see endurance/service.py's
_build_medical_flags) and rendered on the capability page. If this copy or the thresholds below
ever change, treat that as a new copy decision needing the same kind of review, not a routine
code edit - wording in this space can cause real harm whether it's alarmist or too soft.

Scope, and why it's this narrow: Atlas doesn't collect symptoms or medical history, only workout/
biometric data from connected trackers. That rules out anything resembling diagnosis. What's left
is flagging when synced numbers land outside a wide, conservative "this is worth mentioning to a
doctor" band and saying exactly that - never "you have X," always "this number plus a doctor is
how you'd find out if something needs attention." Two flags only, both chosen to minimize false
positives for this app's actual audience (endurance athletes, who routinely have resting heart
rates well below general-population "normal" - so there is deliberately no low-resting-HR flag
here, since that would false-positive on every well-trained user):

- Elevated resting heart rate (>=100 bpm) - general adult resting tachycardia threshold.
- Severe sleep deprivation (<=3h) - a single night this short is unusual enough to flag once,
  not a normal "bad night."
"""

from __future__ import annotations

from dataclasses import dataclass


ELEVATED_RESTING_HR_THRESHOLD_BPM = 100
SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS = 3.0


@dataclass(frozen=True)
class MedicalRedFlag:
    flag_type: str
    severity: str  # "high" | "medium"
    detail: str


def detect_medical_red_flags(
    *, resting_hr: int | None, sleep_hours: float | None
) -> list[MedicalRedFlag]:
    """Pure, stateless detection - no side effects, no API calls, nothing persisted. Returns an
    empty list when nothing is flagged or when there isn't enough data to evaluate, never when
    unsure whether to flag (silence, not a false alarm, is the safe default here).
    """
    flags: list[MedicalRedFlag] = []

    if resting_hr is not None and resting_hr >= ELEVATED_RESTING_HR_THRESHOLD_BPM:
        flags.append(
            MedicalRedFlag(
                flag_type="elevated_resting_heart_rate",
                severity="high",
                detail=f"Resting heart rate of {resting_hr} bpm is at or above {ELEVATED_RESTING_HR_THRESHOLD_BPM} bpm.",
            )
        )

    if sleep_hours is not None and sleep_hours <= SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS:
        flags.append(
            MedicalRedFlag(
                flag_type="severe_sleep_deprivation",
                severity="medium",
                detail=f"Sleep of {sleep_hours:.1f}h is at or below {SEVERE_SLEEP_DEPRIVATION_THRESHOLD_HOURS:.0f}h.",
            )
        )

    return flags


# Reviewed and approved. Deliberately: (1) never says "you have" or names a condition,
# (2) always names the specific number that triggered it so it's checkable, not mysterious,
# (3) always frames the action as "mention to a doctor," never "do X home remedy,"
# (4) never blocks or gates any other app functionality - this is informational only.
ESCALATION_COPY: dict[str, str] = {
    "elevated_resting_heart_rate": (
        "Your synced resting heart rate is higher than usual for a resting reading. This can "
        "have many ordinary causes (recent training load, caffeine, stress, being unwell), but "
        "a reading this high is worth mentioning to a doctor, especially if it continues over "
        "several days. This is not a diagnosis - Atlas only sees the number, not your symptoms "
        "or history."
    ),
    "severe_sleep_deprivation": (
        "Your synced sleep for last night was unusually short. One short night happens, but if "
        "this keeps happening it's worth mentioning to a doctor - sustained severe sleep loss "
        "affects far more than training. This is not a diagnosis - Atlas only sees the number."
    ),
}
