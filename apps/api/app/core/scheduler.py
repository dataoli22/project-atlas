from __future__ import annotations

import asyncio
import logging

from app.features.shared.services.integrations import refresh_strava_token_if_expiring_soon

logger = logging.getLogger("atlas.scheduler")

MAINTENANCE_INTERVAL_SECONDS = 900


async def perform_maintenance_tick() -> None:
    """One pass of background maintenance work. Currently: proactively refresh the Strava token
    if it's expiring soon, so a sync a user triggers later doesn't have to wait on a refresh
    round-trip first (or worse, silently fail if the refresh token itself has gone stale).

    Deliberately a single flat function rather than a registry of jobs - there's exactly one
    maintenance job today. If a second one shows up (Health Connect/Samsung Health don't need
    this, since they're device-permission based, not token-based), turn this into a small list
    of jobs run in sequence rather than over-engineering a job registry now for one job.
    """
    try:
        refreshed = refresh_strava_token_if_expiring_soon()
        if refreshed:
            logger.info("proactively refreshed the Strava token before it expired")
    except Exception:
        logger.exception("background maintenance tick failed while refreshing the Strava token")


async def run_periodic_maintenance(
    *,
    interval_seconds: float = MAINTENANCE_INTERVAL_SECONDS,
    stop_event: asyncio.Event | None = None,
) -> None:
    """Runs perform_maintenance_tick() in a loop until cancelled or stop_event is set.

    A tick's own failures are caught inside perform_maintenance_tick and logged, not raised -
    one bad tick (Strava briefly down) should not kill the loop; the next tick tries again,
    which is the "retry" in "retry queue" for a single-user local app: no separate durable queue
    needed, just try again on the next interval.
    """
    while stop_event is None or not stop_event.is_set():
        await perform_maintenance_tick()
        try:
            if stop_event is not None:
                await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
            else:
                await asyncio.sleep(interval_seconds)
        except asyncio.TimeoutError:
            pass
