from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.error import URLError

from app.core.config import get_settings
from app.features.shared.schemas.app import (
    IntegrationConnectMode,
    IntegrationSourceKey,
    IntegrationSourceStatus,
)
from app.features.shared.services.provider_clients import StravaOAuthClient
from app.features.shared.services.state import shared_state


@dataclass(frozen=True)
class IntegrationOperationResult:
    integration: IntegrationSourceStatus
    launch_url: str | None
    local_only_notice: str


class IntegrationAdapter:
    source: IntegrationSourceKey
    connect_mode: IntegrationConnectMode

    def connect(
        self,
        *,
        account_label: str | None = None,
        login_identifier: str | None = None,
    ) -> IntegrationOperationResult:
        raise NotImplementedError

    def exchange_tokens(self) -> IntegrationOperationResult:
        raise NotImplementedError

    def disconnect(self) -> IntegrationOperationResult:
        integration = shared_state.disconnect_integration(self.source)
        return IntegrationOperationResult(
            integration=integration,
            launch_url=None,
            local_only_notice="The integration has been disconnected from the local Atlas runtime state.",
        )

    def sync(self) -> IntegrationOperationResult:
        integration = shared_state.sync_integration(self.source)
        return IntegrationOperationResult(
            integration=integration,
            launch_url=None,
            local_only_notice=(
                "Sync still uses stub data, but the endpoint contract is now ready for real Strava, Health Connect, "
                "and Samsung Health adapters."
            ),
        )


class StravaIntegrationAdapter(IntegrationAdapter):
    source: IntegrationSourceKey = "strava"
    connect_mode: IntegrationConnectMode = "oauth"

    def connect(
        self,
        *,
        account_label: str | None = None,
        login_identifier: str | None = None,
    ) -> IntegrationOperationResult:
        settings = get_settings()
        integration = shared_state.connect_integration(
            self.source,
            account_label=account_label,
            login_identifier=login_identifier,
        )
        launch_url = _build_strava_launch_url(settings=settings)
        return IntegrationOperationResult(
            integration=integration,
            launch_url=launch_url,
            local_only_notice=(
                "This local-first contract stages a future Strava OAuth launch from the packaged Atlas runtime. "
                "Atlas now prepares a local OAuth state token and a provider launch URL; token exchange is the next step."
            ),
        )

    def exchange_tokens(self) -> IntegrationOperationResult:
        runtime = shared_state.get_integration_runtime_snapshot()["strava"]
        authorization_code = runtime.get("authorization_code")
        if not authorization_code:
            raise ValueError("Capture a Strava authorization code before exchanging tokens.")
        client_id = shared_state.get_strava_client_id()
        client_secret = shared_state.get_strava_client_secret()
        if not client_id or not client_secret:
            raise ValueError(
                "Add your Strava app's client ID and client secret under Settings -> Integrations before exchanging tokens."
            )

        client = StravaOAuthClient(
            client_id=client_id,
            client_secret=client_secret,
        )

        try:
            exchange = client.exchange_code_for_tokens(code=str(authorization_code))
        except (URLError, TimeoutError, OSError) as exc:
            raise ValueError(f"Strava token exchange failed from the local runtime. ({exc})") from exc

        integration = shared_state.complete_strava_token_exchange(
            access_token=exchange.access_token,
            refresh_token=exchange.refresh_token,
            expires_at=exchange.expires_at,
            athlete_id=exchange.athlete_id,
        )
        return IntegrationOperationResult(
            integration=integration,
            launch_url=None,
            local_only_notice=(
                "Strava tokens were stored in the local runtime state file. This is device-local persistence for now; "
                "we can harden it later with OS-backed secure storage."
            ),
        )

    def disconnect(self) -> IntegrationOperationResult:
        runtime = shared_state.get_integration_runtime_snapshot()["strava"]
        access_token = runtime.get("access_token")
        revoke_notice = ""
        if access_token:
            client = StravaOAuthClient(client_id="", client_secret="")
            try:
                client.deauthorize(access_token=str(access_token))
                revoke_notice = " Strava access was also revoked server-side."
            except (URLError, TimeoutError, OSError) as exc:
                revoke_notice = (
                    f" Local disconnect succeeded, but revoking Strava access server-side "
                    f"failed ({exc}); it will remain valid on Strava's side until you revoke it "
                    "manually (strava.com/settings/apps) or the token expires."
                )

        integration = shared_state.disconnect_integration(self.source)
        return IntegrationOperationResult(
            integration=integration,
            launch_url=None,
            local_only_notice=(
                "The integration has been disconnected from the local Atlas runtime state."
                + revoke_notice
            ),
        )

    def sync(self) -> IntegrationOperationResult:
        runtime = shared_state.get_integration_runtime_snapshot()["strava"]
        access_token = runtime.get("access_token")
        refresh_token = runtime.get("refresh_token")
        if not access_token:
            raise ValueError("Exchange Strava tokens before running a live sync.")
        client_id = shared_state.get_strava_client_id()
        client_secret = shared_state.get_strava_client_secret()
        if not client_id or not client_secret:
            raise ValueError(
                "Add your Strava app's client ID and client secret under Settings -> Integrations before running a live sync."
            )

        client = StravaOAuthClient(
            client_id=client_id,
            client_secret=client_secret,
        )
        try:
            access_token = self._refresh_if_needed(
                client=client,
                access_token=str(access_token),
                refresh_token=str(refresh_token) if refresh_token else None,
                runtime=runtime,
            )
            athlete = client.get_athlete_profile(access_token=str(access_token))
            activities = client.list_recent_activities(access_token=str(access_token), per_page=5)
        except (URLError, TimeoutError, OSError) as exc:
            raise ValueError(f"Strava sync failed from the local runtime. ({exc})") from exc

        integration = shared_state.store_strava_sync(
            athlete_profile={
                "athlete_id": athlete.athlete_id,
                "username": athlete.username,
                "firstname": athlete.firstname,
                "lastname": athlete.lastname,
            },
            recent_activities=[
                {
                    "activity_id": item.activity_id,
                    "name": item.name,
                    "sport_type": item.sport_type,
                    "moving_time_seconds": item.moving_time_seconds,
                    "distance_meters": item.distance_meters,
                    "start_date": item.start_date,
                }
                for item in activities
            ],
        )
        return IntegrationOperationResult(
            integration=integration,
            launch_url=None,
            local_only_notice=(
                "Strava athlete and recent activity data were synced into the local Atlas runtime. "
                "The endurance module can now use that synced state without calling a central Atlas backend."
            ),
        )

    def _refresh_if_needed(
        self,
        *,
        client: StravaOAuthClient,
        access_token: str,
        refresh_token: str | None,
        runtime: dict[str, object | None],
    ) -> str:
        expires_at = runtime.get("expires_at")
        if not _token_is_expired(expires_at):
            return access_token
        if not refresh_token:
            raise ValueError("The Strava access token has expired and no refresh token is stored locally.")

        refreshed = client.refresh_access_token(refresh_token=refresh_token)
        shared_state.refresh_strava_token(
            access_token=refreshed.access_token,
            refresh_token=refreshed.refresh_token,
            expires_at=refreshed.expires_at,
            athlete_id=refreshed.athlete_id,
        )
        return refreshed.access_token

    def refresh_token_if_expiring_soon(self, *, buffer_seconds: int = 900) -> bool:
        """Proactively refreshes the stored Strava token if it's expiring soon.

        Called by the periodic maintenance scheduler (core/scheduler.py), not from a user
        request - the point is to refresh *before* the token actually expires, rather than only
        reacting the next time the user happens to trigger a sync. A larger buffer than
        `_refresh_if_needed`'s reactive 60s (15 minutes by default) gives real headroom.
        Returns True if a refresh happened, False if nothing needed doing (not connected, no
        token, or not expiring soon).
        """
        runtime = shared_state.get_integration_runtime_snapshot()["strava"]
        access_token = runtime.get("access_token")
        refresh_token = runtime.get("refresh_token")
        expires_at = runtime.get("expires_at")

        if not access_token or not refresh_token:
            return False
        if not _token_is_expired(expires_at, buffer_seconds=buffer_seconds):
            return False

        client_id = shared_state.get_strava_client_id()
        client_secret = shared_state.get_strava_client_secret()
        if not client_id or not client_secret:
            return False

        client = StravaOAuthClient(
            client_id=client_id,
            client_secret=client_secret,
        )
        refreshed = client.refresh_access_token(refresh_token=str(refresh_token))
        shared_state.refresh_strava_token(
            access_token=refreshed.access_token,
            refresh_token=refreshed.refresh_token,
            expires_at=refreshed.expires_at,
            athlete_id=refreshed.athlete_id,
        )
        return True


class HealthConnectIntegrationAdapter(IntegrationAdapter):
    source: IntegrationSourceKey = "health_connect"
    connect_mode: IntegrationConnectMode = "device-permission"

    def connect(
        self,
        *,
        account_label: str | None = None,
        login_identifier: str | None = None,
    ) -> IntegrationOperationResult:
        integration = shared_state.connect_integration(
            self.source,
            account_label=account_label,
            login_identifier=login_identifier,
        )
        return IntegrationOperationResult(
            integration=integration,
            launch_url="https://developer.android.com/health-and-fitness/guides/health-connect",
            local_only_notice=(
                "Health Connect should stay on-device. The real implementation will request Android permissions from "
                "the local Atlas mobile runtime rather than sending users to a centralized web backend."
            ),
        )

    def sync(self) -> IntegrationOperationResult:
        # Unlike Strava (a desktop-initiated pull against a cloud API), Health Connect only
        # exists on the phone - there is nothing for the desktop to pull from. Real data arrives
        # exclusively via POST /health_connect/device-sync, pushed by the paired Android app's
        # "Sync Health Connect" button (mobile/src/App.tsx). This method used to fabricate two
        # canned sessions labeled "health-connect-live" on every call, which looked like real data
        # but never reflected anything the user's phone actually recorded. Raising here instead
        # surfaces the real requirement instead of quietly lying.
        raise ValueError(
            "Health Connect data only syncs from the paired phone app, not from the desktop. "
            "Pair a phone under Settings -> Phone pairing, then tap \"Sync Health Connect\" there."
        )


class SamsungHealthIntegrationAdapter(IntegrationAdapter):
    source: IntegrationSourceKey = "samsung_health"
    connect_mode: IntegrationConnectMode = "sdk-consent"

    def connect(
        self,
        *,
        account_label: str | None = None,
        login_identifier: str | None = None,
    ) -> IntegrationOperationResult:
        integration = shared_state.connect_integration(
            self.source,
            account_label=account_label,
            login_identifier=login_identifier,
        )
        return IntegrationOperationResult(
            integration=integration,
            launch_url="https://developer.samsung.com/health/android",
            local_only_notice=(
                "Samsung Health consent will ultimately run through the Samsung SDK inside the packaged Atlas app. "
                "This adapter keeps that local-only boundary explicit."
            ),
        )

    def sync(self) -> IntegrationOperationResult:
        # Same reasoning as HealthConnectIntegrationAdapter.sync() above: Samsung Health only
        # exists on the phone, so there's nothing for the desktop to pull. Real data arrives via
        # POST /samsung_health/device-sync from the paired app's "Sync Samsung Health" button.
        raise ValueError(
            "Samsung Health data only syncs from the paired phone app, not from the desktop. "
            "Pair a phone under Settings -> Phone pairing, then tap \"Sync Samsung Health\" there."
        )


def get_integration_adapter(source: IntegrationSourceKey) -> IntegrationAdapter:
    if source == "strava":
        return StravaIntegrationAdapter()
    if source == "health_connect":
        return HealthConnectIntegrationAdapter()
    return SamsungHealthIntegrationAdapter()


def refresh_strava_token_if_expiring_soon(*, buffer_seconds: int = 900) -> bool:
    """Entry point for core/scheduler.py - avoids the scheduler depending on the concrete
    StravaIntegrationAdapter type just to reach a Strava-specific method."""
    return StravaIntegrationAdapter().refresh_token_if_expiring_soon(buffer_seconds=buffer_seconds)


def _build_strava_launch_url(*, settings) -> str:
    client_id = shared_state.get_strava_client_id()
    if not client_id or not settings.strava_redirect_uri:
        return "https://developers.strava.com/docs/authentication/"

    state_token = shared_state.prepare_strava_oauth()
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": settings.strava_redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": settings.strava_scopes,
            "state": state_token,
        }
    )
    return f"https://www.strava.com/oauth/authorize?{query}"


def _token_is_expired(expires_at: object | None, *, buffer_seconds: int = 60) -> bool:
    if not isinstance(expires_at, int):
        return False
    return expires_at <= int(datetime.now(timezone.utc).timestamp()) + buffer_seconds
