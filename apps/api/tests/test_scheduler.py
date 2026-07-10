import asyncio
import logging

from app.core import scheduler


def test_perform_maintenance_tick_logs_when_a_refresh_happens(monkeypatch, caplog):
    monkeypatch.setattr(scheduler, "refresh_strava_token_if_expiring_soon", lambda: True)

    with caplog.at_level(logging.INFO, logger="atlas.scheduler"):
        asyncio.run(scheduler.perform_maintenance_tick())

    assert any("refreshed the Strava token" in record.getMessage() for record in caplog.records)


def test_perform_maintenance_tick_is_quiet_when_nothing_needed_refreshing(monkeypatch, caplog):
    monkeypatch.setattr(scheduler, "refresh_strava_token_if_expiring_soon", lambda: False)

    with caplog.at_level(logging.INFO, logger="atlas.scheduler"):
        asyncio.run(scheduler.perform_maintenance_tick())

    assert not any("refreshed the Strava token" in record.getMessage() for record in caplog.records)


def test_perform_maintenance_tick_survives_an_unexpected_exception(monkeypatch, caplog):
    def _boom():
        raise RuntimeError("Strava is down")

    monkeypatch.setattr(scheduler, "refresh_strava_token_if_expiring_soon", _boom)

    with caplog.at_level(logging.ERROR, logger="atlas.scheduler"):
        asyncio.run(scheduler.perform_maintenance_tick())  # must not raise

    assert any("maintenance tick failed" in record.getMessage() for record in caplog.records)


def test_run_periodic_maintenance_ticks_until_stop_event_is_set():
    tick_count = {"value": 0}

    async def fake_tick():
        tick_count["value"] += 1

    async def scenario():
        original_tick = scheduler.perform_maintenance_tick
        scheduler.perform_maintenance_tick = fake_tick
        try:
            stop_event = asyncio.Event()

            async def stop_after_a_few_ticks():
                while tick_count["value"] < 3:
                    await asyncio.sleep(0)
                stop_event.set()

            await asyncio.gather(
                scheduler.run_periodic_maintenance(interval_seconds=0, stop_event=stop_event),
                stop_after_a_few_ticks(),
            )
        finally:
            scheduler.perform_maintenance_tick = original_tick

    asyncio.run(scenario())

    assert tick_count["value"] >= 3
