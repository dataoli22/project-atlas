from __future__ import annotations

from datetime import datetime

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


def get_endurance_dashboard() -> EnduranceDashboardResponse:
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
                value=str(_capability_score_from_activities(activities)),
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


def get_endurance_insights() -> EnduranceInsightsResponse:
    runtime = shared_state.get_integration_runtime_snapshot()
    activities = _combined_recent_sessions(runtime)
    if not activities:
        return get_stub_insights()

    total_seconds = sum(_session_duration_seconds(item) for item in activities)
    total_distance = sum(_session_distance_meters(item) for item in activities)
    capability_score = _capability_score_from_activities(activities)
    latest = activities[0]
    coverage = sorted({str(item.get("source") or "local-runtime") for item in activities})
    health_connect_runtime = runtime["health_connect"]
    samsung_runtime = runtime["samsung_health"]
    hydration_ml = health_connect_runtime.get("hydration_ml")
    sleep_hours = samsung_runtime.get("sleep_hours")
    generated_at = latest.get("start_date") or "2026-07-08T09:00:00Z"

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
                    score=min(90, 45 + int((float(hydration_ml or 0) / 200)) + int((float(sleep_hours or 0) * 2))),
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


def _capability_score_from_activities(activities: list[dict[str, object | None]]) -> int:
    total_seconds = sum(_session_duration_seconds(item) for item in activities)
    total_distance = sum(_session_distance_meters(item) for item in activities)
    return min(95, 40 + int(total_seconds / 1200) + int(total_distance / 5000))


def _combined_recent_sessions(runtime: dict[str, dict[str, object | None]]) -> list[dict[str, object | None]]:
    sessions: list[dict[str, object | None]] = []
    sessions.extend(_recent_strava_activities(runtime["strava"]))
    sessions.extend(_runtime_session_list(runtime["health_connect"], key="recent_sessions"))
    sessions.extend(_runtime_session_list(runtime["samsung_health"], key="recent_sessions"))
    sessions.sort(key=lambda item: str(item.get("start_date") or ""), reverse=True)
    return sessions


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


def _coverage_trend_label(coverage: list[str]) -> str:
    if coverage == ["strava-live"]:
        return "Synced from Strava"
    if not coverage:
        return "Local runtime"
    return ", ".join(coverage[:2])


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
