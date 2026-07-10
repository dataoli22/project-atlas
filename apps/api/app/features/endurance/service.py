from __future__ import annotations

from datetime import datetime, timezone

from app.features.endurance.schemas import (
    EnduranceCapabilityArea,
    EnduranceCapabilitySnapshot,
    EnduranceDashboardCard,
    EnduranceDashboardResponse,
    EnduranceInsightItem,
    EnduranceInsightsResponse,
    EnduranceSupportLink,
    EnduranceTimelineEntry,
    EnduranceTimelineResponse,
    EnduranceWorkoutSummary,
)
from app.features.shared.services.state import shared_state


def get_stub_dashboard() -> EnduranceDashboardResponse:
    return EnduranceDashboardResponse(
        generated_at="2026-07-08T09:00:00Z",
        cards=[
            EnduranceDashboardCard(
                label="Capability score",
                value="72",
                trend="+4 vs last week",
            ),
            EnduranceDashboardCard(
                label="7-day load",
                value="6h 40m",
                trend="Within target band",
            ),
            EnduranceDashboardCard(
                label="Recovery status",
                value="Moderate",
                trend="Hydration improving",
            ),
        ],
        latest_workout=EnduranceWorkoutSummary(
            title="Trail endurance session",
            duration="1h 48m",
            distance="14.2 km",
            recovery_note="Keep today easy and prioritize sleep plus hydration.",
        ),
        coach_summary=(
            "Your recent load is progressing cleanly. The next useful step is a lower-stress day "
            "so the long effort converts into adaptation instead of fatigue."
        ),
        support_links=_support_links("2026-07-08T09:00:00Z", all_disconnected=True),
    )


def get_stub_timeline() -> EnduranceTimelineResponse:
    return EnduranceTimelineResponse(
        generated_at="2026-07-08T09:00:00Z",
        entries=[
            EnduranceTimelineEntry(
                day_label="Mon",
                session_label="Easy run",
                duration="42m",
                load="Low aerobic",
                source="strava-stub",
            ),
            EnduranceTimelineEntry(
                day_label="Tue",
                session_label="Mobility and strength",
                duration="35m",
                load="Support work",
                source="manual-stub",
            ),
            EnduranceTimelineEntry(
                day_label="Wed",
                session_label="Tempo intervals",
                duration="1h 06m",
                load="High quality",
                source="google-fit-stub",
            ),
            EnduranceTimelineEntry(
                day_label="Thu",
                session_label="Recovery walk",
                duration="28m",
                load="Reset",
                source="samsung-health-stub",
            ),
        ],
    )


def get_stub_insights() -> EnduranceInsightsResponse:
    return EnduranceInsightsResponse(
        generated_at="2026-07-08T09:00:00Z",
        capability=EnduranceCapabilitySnapshot(
            headline="Aerobic durability is trending up, while recovery rhythm still needs consistency.",
            areas=[
                EnduranceCapabilityArea(
                    label="Aerobic base",
                    score=78,
                    direction="+5 this week",
                ),
                EnduranceCapabilityArea(
                    label="Recovery readiness",
                    score=64,
                    direction="Flat",
                ),
                EnduranceCapabilityArea(
                    label="Heat and hydration resilience",
                    score=71,
                    direction="+2 this week",
                ),
            ],
        ),
        insights=[
            EnduranceInsightItem(
                title="Protect the next low day",
                detail="Your quality work is landing well, but adaptation depends on keeping the next day genuinely easy.",
                priority="high",
            ),
            EnduranceInsightItem(
                title="Hydration routine is improving",
                detail="Recent training days show fewer recovery dips when hydration is front-loaded before midday sessions.",
                priority="medium",
            ),
            EnduranceInsightItem(
                title="Strength support is paying off",
                detail="Short support sessions are helping maintain consistency without inflating overall load.",
                priority="low",
            ),
        ],
        support_links=_support_links("2026-07-08T09:00:00Z", all_disconnected=True),
    )


def get_endurance_dashboard(*, now: datetime | None = None) -> EnduranceDashboardResponse:
    runtime = shared_state.get_integration_runtime_snapshot()
    activities = _combined_recent_sessions(runtime)
    strava_runtime = runtime["strava"]
    athlete = strava_runtime.get("athlete_profile")
    if not activities:
        return get_stub_dashboard()

    latest = activities[0]
    total_seconds = sum(_session_duration_seconds(item) for item in activities)
    total_distance = sum(_session_distance_meters(item) for item in activities)
    athlete_name = _athlete_name(athlete)
    generated_at = latest.get("start_date") or "2026-07-08T09:00:00Z"
    coverage = sorted({str(item.get("source") or "local-runtime") for item in activities})

    return EnduranceDashboardResponse(
        generated_at=generated_at,
        cards=[
            EnduranceDashboardCard(
                label="Capability score",
                value=str(_capability_score_from_activities(activities, now=now)),
                trend=f"{len(activities)} recent sessions across {len(coverage)} sources",
            ),
            EnduranceDashboardCard(
                label="Recent moving time",
                value=_format_duration(total_seconds),
                trend=_coverage_trend_label(coverage),
            ),
            EnduranceDashboardCard(
                label="Recent distance",
                value=_format_distance(total_distance),
                trend=athlete_name if athlete_name != "Synced athlete" else "Multi-source endurance view",
            ),
        ],
        latest_workout=EnduranceWorkoutSummary(
            title=str(latest.get("name") or "Recent Strava activity"),
            duration=_format_duration(_session_duration_seconds(latest)),
            distance=_format_distance(_session_distance_meters(latest)),
            recovery_note=(
                "Use the combined workload view as the primary endurance anchor, then layer hydration, sleep, and "
                "body metrics from Health Connect and Samsung Health before increasing load."
            ),
        ),
        coach_summary=(
            f"{athlete_name} now has multi-source endurance coverage in Atlas. Review the latest {len(activities)} "
            "sessions first, then decide whether the combined load and recovery picture supports more quality or needs a lighter follow-up."
        ),
        support_links=_support_links(generated_at),
    )


def get_endurance_timeline() -> EnduranceTimelineResponse:
    runtime = shared_state.get_integration_runtime_snapshot()
    activities = _combined_recent_sessions(runtime)
    if not activities:
        return get_stub_timeline()

    return EnduranceTimelineResponse(
        generated_at=activities[0].get("start_date") or "2026-07-08T09:00:00Z",
        entries=[
            EnduranceTimelineEntry(
                day_label=_format_day_label(str(item.get("start_date") or "")),
                session_label=str(item.get("name") or item.get("session_label") or "Recent session"),
                duration=_format_duration(_session_duration_seconds(item)),
                load=str(item.get("sport_type") or item.get("session_type") or "Workout"),
                source=str(item.get("source") or "local-runtime"),
            )
            for item in activities
        ],
    )


def get_endurance_insights(*, now: datetime | None = None) -> EnduranceInsightsResponse:
    runtime = shared_state.get_integration_runtime_snapshot()
    activities = _combined_recent_sessions(runtime)
    if not activities:
        return get_stub_insights()

    total_seconds = sum(_session_duration_seconds(item) for item in activities)
    total_distance = sum(_session_distance_meters(item) for item in activities)
    capability_score = _capability_score_from_activities(activities, now=now)
    latest = activities[0]
    coverage = sorted({str(item.get("source") or "local-runtime") for item in activities})
    health_connect_runtime = runtime["health_connect"]
    samsung_runtime = runtime["samsung_health"]
    hydration_ml = health_connect_runtime.get("hydration_ml")
    sleep_hours = samsung_runtime.get("sleep_hours")
    generated_at = latest.get("start_date") or "2026-07-08T09:00:00Z"

    confidence, confidence_note = _capability_confidence(coverage, now=now)

    return EnduranceInsightsResponse(
        generated_at=generated_at,
        capability=EnduranceCapabilitySnapshot(
            headline=(
                "Live Strava activity data is now shaping this capability view, so the current score reflects actual "
                "recent volume instead of stub training history."
                if coverage == ["strava-live"]
                else "Live connector data is now shaping this capability view, so the current score reflects combined "
                "recent workload and recovery context instead of stub training history."
            ),
            confidence=confidence,
            confidence_note=confidence_note,
            areas=[
                EnduranceCapabilityArea(
                    label="Aerobic base",
                    score=min(95, capability_score),
                    direction=f"{len(activities)} synced sessions",
                ),
                EnduranceCapabilityArea(
                    label="Recent volume tolerance",
                    score=min(92, 50 + int(total_seconds / 900)),
                    direction=_format_duration(total_seconds),
                ),
                EnduranceCapabilityArea(
                    label="Recovery support",
                    score=_normalized_recovery_score(hydration_ml, sleep_hours),
                    direction=_recovery_direction(hydration_ml=hydration_ml, sleep_hours=sleep_hours),
                ),
            ],
        ),
        insights=[
            EnduranceInsightItem(
                title="Review the latest synced session first",
                detail=(
                    f"{latest.get('name') or latest.get('session_label') or 'Your latest synced session'} is now the anchor for Atlas endurance reasoning."
                ),
                priority="high",
            ),
            EnduranceInsightItem(
                title="Check whether recent volume matches recovery support",
                detail=(
                    f"Coverage now spans {', '.join(coverage)}. Use hydration and sleep context to decide whether the combined load needs a lighter follow-up."
                ),
                priority="medium",
            ),
            EnduranceInsightItem(
                title="Keep expanding local connector depth",
                detail="Each connector already feeds the same endurance contract, so deeper packaged-app adapters can improve fidelity without changing the surface area.",
                priority="low",
            ),
        ],
        support_links=_support_links(generated_at),
    )


def _recent_strava_activities(runtime: dict[str, object | None]) -> list[dict[str, object | None]]:
    activities = runtime.get("recent_activities")
    if not isinstance(activities, list):
        return []
    return [item for item in activities if isinstance(item, dict)]


def _format_duration(total_seconds: int) -> str:
    hours, remainder = divmod(max(total_seconds, 0), 3600)
    minutes = remainder // 60
    if hours > 0:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


def _format_distance(distance_meters: float) -> str:
    return f"{distance_meters / 1000:.1f} km"


def _format_day_label(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%a")
    except ValueError:
        return "Day"


def _athlete_name(athlete: object | None) -> str:
    if not isinstance(athlete, dict):
        return "Synced athlete"
    parts = [str(athlete.get("firstname") or "").strip(), str(athlete.get("lastname") or "").strip()]
    full_name = " ".join(part for part in parts if part)
    return full_name or str(athlete.get("username") or "Synced athlete")


CAPABILITY_WINDOW_DAYS = 14
_WINDOW_FLOOR_WEIGHT = 0.15


def _capability_score_from_activities(
    activities: list[dict[str, object | None]], *, now: datetime | None = None
) -> int:
    """Weights each session's contribution to the score by how recent it is, instead of treating
    a session from three weeks ago identically to one from this morning. A session from the last
    day counts fully; weight decays linearly out to CAPABILITY_WINDOW_DAYS, then holds at a small
    floor (never zero - a session just outside the window still says something about capability,
    just less than a fresh one). Sessions with an unparseable date aren't penalized (weight 1.0)
    rather than silently dropped, since a missing/malformed timestamp isn't evidence of staleness.
    `now` is injectable so this stays testable without a fixed window silently drifting as real
    dates age past it.
    """
    now = now or datetime.now(timezone.utc)
    weighted_seconds = sum(
        _session_duration_seconds(item) * _recency_weight(item, now=now) for item in activities
    )
    weighted_distance = sum(
        _session_distance_meters(item) * _recency_weight(item, now=now) for item in activities
    )
    return min(95, 40 + int(weighted_seconds / 1200) + int(weighted_distance / 5000))


def _recency_weight(item: dict[str, object | None], *, now: datetime) -> float:
    start = _parse_start_date(item.get("start_date"))
    if start is None:
        return 1.0

    age_days = max(0.0, (now - start).total_seconds() / 86400)
    if age_days <= 1:
        return 1.0
    if age_days >= CAPABILITY_WINDOW_DAYS:
        return _WINDOW_FLOOR_WEIGHT

    decay_span = CAPABILITY_WINDOW_DAYS - 1
    progress = (age_days - 1) / decay_span
    return 1.0 - progress * (1.0 - _WINDOW_FLOOR_WEIGHT)


def _parse_start_date(value: object | None) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _combined_recent_sessions(runtime: dict[str, dict[str, object | None]]) -> list[dict[str, object | None]]:
    sessions: list[dict[str, object | None]] = []
    sessions.extend(_recent_strava_activities(runtime["strava"]))
    sessions.extend(_runtime_session_list(runtime["health_connect"], key="recent_sessions"))
    sessions.extend(_runtime_session_list(runtime["samsung_health"], key="recent_sessions"))
    sessions = _dedupe_cross_source_sessions(sessions)
    sessions.sort(key=lambda item: str(item.get("start_date") or ""), reverse=True)
    return sessions


def _dedupe_cross_source_sessions(
    sessions: list[dict[str, object | None]],
) -> list[dict[str, object | None]]:
    """Collapses the same physical workout when it's synced from more than one connector.

    A real gap without this: a user with both Strava and Health Connect connected (Samsung
    Health also writes into Health Connect on modern devices, compounding it) would see the same
    run counted twice - once per source - inflating total volume, distance, and the capability
    score derived from them. Sources are appended to `sessions` in a fixed priority order
    (Strava, then Health Connect, then Samsung Health), and `dict.fromkeys`-style "first wins"
    dedup keeps whichever source reported it first, so Strava's richer activity data (real name,
    exact distance) is kept over a coarser Health Connect/Samsung Health record of the same
    session when both exist.

    Two sessions are considered the same workout if they start within the same 5-minute window
    and have roughly the same duration (also bucketed to 5 minutes) - different connectors
    routinely disagree on a workout's exact start second (auto-pause, GPS lock delay, manual
    start vs. detected start), so exact-timestamp equality would miss real duplicates. 5 minutes
    is generous enough to catch that skew without being so wide it collapses two genuinely
    different sessions that happen to start close together (e.g. a warmup walk followed
    immediately by a run).
    """
    seen_keys: set[tuple[int, int]] = set()
    deduped: list[dict[str, object | None]] = []
    for item in sessions:
        key = _session_dedupe_key(item)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(item)
    return deduped


def _session_dedupe_key(item: dict[str, object | None]) -> tuple[int, int]:
    start_bucket = _session_start_epoch_seconds(item) // 300  # 5-minute buckets
    duration_bucket = _session_duration_seconds(item) // 300  # 5-minute buckets
    return (start_bucket, duration_bucket)


def _session_start_epoch_seconds(item: dict[str, object | None]) -> int:
    value = str(item.get("start_date") or "")
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


def _runtime_session_list(runtime: dict[str, object | None], *, key: str) -> list[dict[str, object | None]]:
    items = runtime.get(key)
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _session_duration_seconds(item: dict[str, object | None]) -> int:
    if item.get("moving_time_seconds") is not None:
        return int(item.get("moving_time_seconds", 0) or 0)
    return int(float(item.get("duration_minutes", 0) or 0) * 60)


def _session_distance_meters(item: dict[str, object | None]) -> float:
    if item.get("distance_meters") is not None:
        return float(item.get("distance_meters", 0.0) or 0.0)
    return float(item.get("distance_km", 0.0) or 0.0) * 1000


def _recovery_direction(*, hydration_ml: object | None, sleep_hours: object | None) -> str:
    hydration_part = f"{int(float(hydration_ml or 0))} ml hydration" if hydration_ml is not None else "hydration unavailable"
    sleep_part = f"{float(sleep_hours):.1f} h sleep" if sleep_hours is not None else "sleep unavailable"
    return f"{hydration_part} | {sleep_part}"


# General wellness heuristics, not medical guidance - same non-medical framing as the rest of the
# endurance coach (see _support_links). ~35ml/kg/day hydration and 7-9h sleep are commonly cited
# general targets for a lightly active adult, not personalized clinical thresholds; a real
# implementation would let a clinician or the user override these, not hardcode them.
_DEFAULT_HYDRATION_TARGET_ML = 2500.0
_HYDRATION_ML_PER_KG = 35.0
_SLEEP_TARGET_LOW_HOURS = 7.0
_SLEEP_TARGET_HIGH_HOURS = 9.0
_LB_TO_KG = 0.45359237


def _hydration_target_ml() -> float:
    """Personalizes the hydration target to the user's own recorded body weight when available,
    falling back to a general adult default otherwise - normalizing against a fixed number
    regardless of body size would under- or over-credit hydration for anyone far from an assumed
    average.
    """
    profile = shared_state.get_profile()
    if profile.body_weight is not None and profile.body_weight.value > 0:
        weight_kg = (
            profile.body_weight.value
            if profile.body_weight.unit == "kg"
            else profile.body_weight.value * _LB_TO_KG
        )
        return weight_kg * _HYDRATION_ML_PER_KG
    return _DEFAULT_HYDRATION_TARGET_ML


def _normalize_hydration_score(hydration_ml: object | None, *, target_ml: float) -> int:
    if not hydration_ml or target_ml <= 0:
        return 0
    ratio = min(1.3, float(hydration_ml) / target_ml)  # cap credit at 130% of target
    return int(min(100, ratio * 100))


def _normalize_sleep_score(sleep_hours: object | None) -> int:
    if not sleep_hours:
        return 0
    hours = float(sleep_hours)
    if _SLEEP_TARGET_LOW_HOURS <= hours <= _SLEEP_TARGET_HIGH_HOURS:
        return 100
    if hours < _SLEEP_TARGET_LOW_HOURS:
        deficit = _SLEEP_TARGET_LOW_HOURS - hours
        return max(0, int(100 - deficit * 20))
    excess = hours - _SLEEP_TARGET_HIGH_HOURS
    return max(0, int(100 - excess * 10))


def _normalized_recovery_score(hydration_ml: object | None, sleep_hours: object | None) -> int:
    if hydration_ml is None and sleep_hours is None:
        return 45  # matches the stub/no-data baseline used elsewhere in this module

    target_ml = _hydration_target_ml()
    hydration_score = _normalize_hydration_score(hydration_ml, target_ml=target_ml)
    sleep_score = _normalize_sleep_score(sleep_hours)

    if hydration_ml is None:
        return sleep_score
    if sleep_hours is None:
        return hydration_score
    return int((hydration_score + sleep_score) / 2)


def _coverage_trend_label(coverage: list[str]) -> str:
    if coverage == ["strava-live"]:
        return "Synced from Strava"
    if not coverage:
        return "Local runtime"
    return ", ".join(coverage[:2])


_COVERAGE_LABEL_TO_INTEGRATION_KEY = {
    "strava-live": "strava",
    "health-connect-live": "health_connect",
    "samsung-health-live": "samsung_health",
}

_CONFIDENCE_HIGH_MAX_HOURS = 24
_CONFIDENCE_MEDIUM_MAX_HOURS = 72


def _capability_confidence(
    coverage: list[str], *, now: datetime | None = None
) -> tuple[str, str]:
    """How much the current capability score should be trusted, based on how stale the synced
    connector data behind it is - not the same thing as how much volume was synced. A score
    built from a sync that happened a week ago describes last week, not now, no matter how much
    data it contains. Injectable `now` so this stays testable without dates silently aging past
    a threshold as real time passes.
    """
    now = now or datetime.now(timezone.utc)
    integrations_by_key = {integration.key: integration for integration in shared_state.get_integrations()}

    ages_hours: list[float] = []
    for coverage_label in coverage:
        integration_key = _COVERAGE_LABEL_TO_INTEGRATION_KEY.get(coverage_label)
        if integration_key is None:
            continue
        integration = integrations_by_key.get(integration_key)
        if integration is None or not integration.last_sync_at:
            continue
        try:
            synced_at = datetime.fromisoformat(str(integration.last_sync_at).replace("Z", "+00:00"))
        except ValueError:
            continue
        ages_hours.append(max(0.0, (now - synced_at).total_seconds() / 3600))

    if not ages_hours:
        return "low", "Sync freshness for the connected sources isn't available yet."

    freshest_age = min(ages_hours)
    age_label = _format_age_hours(freshest_age)

    if freshest_age <= _CONFIDENCE_HIGH_MAX_HOURS:
        return "high", f"Most recent sync was {age_label} ago."
    if freshest_age <= _CONFIDENCE_MEDIUM_MAX_HOURS:
        return (
            "medium",
            f"Most recent sync was {age_label} ago - sync again for the freshest picture.",
        )
    return (
        "low",
        f"Most recent sync was {age_label} ago - this view may not reflect recent training.",
    )


def _format_age_hours(age_hours: float) -> str:
    if age_hours < 1:
        return "less than an hour"
    if age_hours < 48:
        return f"{int(age_hours)}h"
    return f"{int(age_hours / 24)}d"


# Curated, non-medical training resources. These are static, deterministic links
# (YouTube search URLs and official developer docs) surfaced by the endurance coach.
_TRAINING_SUPPORT_LINKS: list[dict[str, str]] = [
    {
        "title": "Runner recovery and mobility routine",
        "url": "https://www.youtube.com/results?search_query=runner+recovery+mobility+routine",
        "topic": "Recovery and mobility",
        "why_recommended": (
            "Guided recovery and mobility work helps convert training load into adaptation and "
            "keeps stride quality consistent between sessions."
        ),
        "resource_type": "recovery",
    },
    {
        "title": "Strength training for runners",
        "url": "https://www.youtube.com/results?search_query=strength+training+for+runners",
        "topic": "Strength for endurance",
        "why_recommended": (
            "Short strength sessions support durability and injury resilience without inflating "
            "overall endurance load."
        ),
        "resource_type": "strength",
    },
    {
        "title": "Endurance base training for beginners",
        "url": "https://www.youtube.com/results?search_query=endurance+base+training+for+beginners",
        "topic": "Base training",
        "why_recommended": (
            "Building an aerobic base is the highest-return way to raise sustainable capacity before "
            "adding faster, higher-stress work."
        ),
        "resource_type": "base-training",
    },
]

# Static metadata for connector-setup help, keyed by the shared integration key.
_CONNECTOR_SETUP_LINKS: dict[str, dict[str, str]] = {
    "strava": {
        "title": "Set up Strava (authentication)",
        "url": "https://developers.strava.com/docs/authentication/",
        "topic": "Strava connector",
    },
    "health_connect": {
        "title": "Set up Health Connect",
        "url": "https://developer.android.com/health-and-fitness/guides/health-connect",
        "topic": "Health Connect connector",
    },
    "samsung_health": {
        "title": "Set up Samsung Health",
        "url": "https://developer.samsung.com/health/android",
        "topic": "Samsung Health connector",
    },
}


def _support_links(generated_at: str, *, all_disconnected: bool = False) -> list[EnduranceSupportLink]:
    """Build the curated, non-medical support links for the endurance coach.

    Connector-setup links are contextual: setup help for connectors that are not yet
    connected is surfaced first with wording that reflects the missing connection.
    """
    training_links = [
        EnduranceSupportLink(
            title=item["title"],
            url=item["url"],
            topic=item["topic"],
            why_recommended=item["why_recommended"],
            resource_type=item["resource_type"],
            freshness_at=generated_at,
        )
        for item in _TRAINING_SUPPORT_LINKS
    ]

    if all_disconnected:
        connection_state = {key: False for key in _CONNECTOR_SETUP_LINKS}
        titles = {key: meta["title"] for key, meta in _CONNECTOR_SETUP_LINKS.items()}
    else:
        integrations = shared_state.get_integrations()
        connection_state = {
            integration.key: bool(integration.connected) for integration in integrations
        }
        titles = {integration.key: integration.title for integration in integrations}

    disconnected_links: list[EnduranceSupportLink] = []
    connected_links: list[EnduranceSupportLink] = []
    for key, meta in _CONNECTOR_SETUP_LINKS.items():
        connected = connection_state.get(key, False)
        source_title = titles.get(key, meta["title"])
        if connected:
            why = (
                f"{source_title} is already connected. Keep this setup reference handy for "
                "re-authorizing or troubleshooting sync on this device."
            )
        else:
            why = (
                f"{source_title} is not connected yet. Connecting it adds richer training and "
                "recovery signals to your endurance view."
            )
        link = EnduranceSupportLink(
            title=meta["title"],
            url=meta["url"],
            topic=meta["topic"],
            why_recommended=why,
            resource_type="connector-setup",
            freshness_at=generated_at,
        )
        if connected:
            connected_links.append(link)
        else:
            disconnected_links.append(link)

    # Disconnected connectors first (prioritized), then training resources, then connected ones.
    return [*disconnected_links, *training_links, *connected_links]
