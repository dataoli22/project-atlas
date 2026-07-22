"use client";

import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import type { ApiDataSource } from "@/lib/api";
import { CONNECTOR_INFO, isFullyConnected, pendingConnectionNote } from "@/lib/connector-info";
import type { IntegrationSourceData } from "@/lib/settings-data";
import {
  completeStravaCallback,
  connectIntegrationSource,
  disconnectIntegrationSource,
  exchangeStravaTokens,
  syncIntegrationSource
} from "@/lib/settings-data";

type ConnectorPanelProps = {
  initialIntegration: IntegrationSourceData;
  initialSource: ApiDataSource;
  /** Omits the outer panel chrome and intro copy, for composing inside a parent panel that
   * already explains what this connector does (e.g. the Setup wizard's combined Strava step,
   * which merges this with <StravaAppSettingsForm> rather than showing two near-duplicate
   * "what is Strava / why connect it" panels back to back). */
  embedded?: boolean;
  /** Overrides the step heading shown when embedded (defaults to the connector's own title). */
  embeddedTitle?: string;
  /** Called when the user clicks the "Pair your device" reference shown for phone-synced
   * connectors (Health Connect, Samsung Health) once connected. Renders as a plain-text mention
   * with no href when omitted, since ConnectorPanel has no route/step of its own to link to. */
  onPairDeviceClick?: () => void;
};

/**
 * Full connect/disconnect/sync UI for a single health-app connector (Strava, Health Connect, or
 * Samsung Health). Self-contained so it can be dropped into a single Setup wizard step - this is
 * the only place that logic lives now that the standalone Integrations page has been retired.
 */
export function ConnectorPanel({
  initialIntegration,
  initialSource,
  embedded = false,
  embeddedTitle,
  onPairDeviceClick
}: ConnectorPanelProps) {
  const connectorKey = initialIntegration.key;
  const connector = CONNECTOR_INFO.find((item) => item.key === connectorKey);

  const [integration, setIntegration] = useState(initialIntegration);
  const [accountLabel, setAccountLabel] = useState("");
  const [stravaCallbackUrl, setStravaCallbackUrl] = useState("");
  const [stravaCode, setStravaCode] = useState("");
  const [stravaState, setStravaState] = useState("");
  const [stravaLaunchUrl, setStravaLaunchUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [isPending, startTransition] = useTransition();

  if (!connector) {
    return null;
  }

  const fullyConnected = isFullyConnected(integration);
  const pendingNote = pendingConnectionNote(integration);

  function connect() {
    startTransition(async () => {
      const result = await connectIntegrationSource({ source: connectorKey, accountLabel });

      setIntegration(result.data.integration);
      setLastSource(result.source);
      setStravaLaunchUrl(result.data.launchUrl);
      setStatus(
        result.source === "api"
          ? connectorKey === "strava"
            ? "Connected. Finish signing in below to complete setup."
            : "Connected."
          : "Could not reach the local app. Try again."
      );
      setAccountLabel("");
    });
  }

  function finishStravaSignIn() {
    const value = stravaCallbackUrl.trim();
    if (!value) {
      setStatus("Enter the redirect URL Strava returned before continuing.");
      return;
    }

    let code = stravaCode.trim();
    let state = stravaState.trim();

    try {
      const parsedUrl = new URL(value);
      code = parsedUrl.searchParams.get("code")?.trim() ?? code;
      state = parsedUrl.searchParams.get("state")?.trim() ?? state;
    } catch {
      setStatus("This does not appear to be a valid URL. Enter the full redirect address Strava returned.");
      return;
    }

    if (!code || !state) {
      setStatus("The redirect URL is missing required parameters. Sign in again.");
      return;
    }

    startTransition(async () => {
      const callbackResult = await completeStravaCallback({ code, state });

      if (callbackResult.source !== "api") {
        setStatus("Could not reach the local app. Try again.");
        return;
      }

      const exchangeResult = await exchangeStravaTokens();
      setIntegration(exchangeResult.data.integration);
      setLastSource(exchangeResult.source);
      setStatus(
        exchangeResult.source === "api" ? "Strava connected successfully." : "Signed in, but activation failed. Try again."
      );
      setStravaCallbackUrl("");
      setStravaCode("");
      setStravaState("");
    });
  }

  function disconnect() {
    const confirmed = window.confirm(`Disconnect ${integration.title}? This removes its saved login and synced data.`);
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectIntegrationSource(connectorKey);
      setIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(result.source === "api" ? `${result.data.integration.title} disconnected.` : "Could not reach the local app. Try again.");
      setAccountLabel("");
    });
  }

  function sync() {
    startTransition(async () => {
      const result = await syncIntegrationSource(connectorKey);
      setIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(result.source === "api" ? `${result.data.integration.title} synced.` : "Could not reach the local app. Try again.");
    });
  }

  function runtimeText(key: string) {
    const value = integration.runtimeSummary[key];
    if (value === null || value === undefined || value === "") {
      return null;
    }
    return String(value);
  }

  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper className={embedded ? "atlas-stack" : "atlas-panel atlas-stack"}>
      {!embedded ? (
        <>
          <div className="atlas-panel__eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <connector.icon size={16} strokeWidth={2} aria-hidden="true" />
            {connector.title}
            <HintTooltip label={connector.hintLabel}>{connector.hint}</HintTooltip>
          </div>
          <p className="atlas-note">{connector.detail}</p>
          <p className="atlas-note">{connector.hint}</p>
        </>
      ) : (
        <div className="atlas-list-card__title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <connector.icon size={16} strokeWidth={2} aria-hidden="true" />
          {embeddedTitle ?? `Connect your ${connector.title} account`}
          <HintTooltip label={connector.hintLabel}>{connector.hint}</HintTooltip>
        </div>
      )}

      <div className="atlas-meta">
        <span className={fullyConnected ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
          {fullyConnected ? "Connected" : integration.connected ? "Pending" : "Not connected"}
        </span>
      </div>
      {pendingNote ? <p className="atlas-note">{pendingNote}</p> : null}
      {integration.accountLabel ? <div className="atlas-list-card__meta">Label: {integration.accountLabel}</div> : null}

      {!integration.connected ? (
        <div className="atlas-form-field">
          <span>Name this connection (optional)</span>
          <input
            type="text"
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
            placeholder="My phone, Galaxy Watch..."
          />
        </div>
      ) : null}

      {connectorKey === "strava" && integration.connected && !integration.runtimeSummary.token_exchange_ready ? (
        <div className="atlas-list-card">
          <div className="atlas-list-card__title">Finish signing in to Strava</div>
          <div className="atlas-list-card__meta">
            Open the link below, sign in to Strava, then copy the resulting redirect address back here.
          </div>
          {stravaLaunchUrl ? (
            <div className="atlas-list-card__meta" style={{ marginTop: "8px" }}>
              <a href={stravaLaunchUrl} target="_blank" rel="noreferrer" className="atlas-button atlas-button--secondary">
                Open Strava sign-in
              </a>
            </div>
          ) : null}
          <div className="atlas-form-field" style={{ marginTop: "10px" }}>
            <span>Redirect URL from Strava</span>
            <input
              type="text"
              value={stravaCallbackUrl}
              onChange={(event) => setStravaCallbackUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={finishStravaSignIn}
              disabled={isPending || !stravaCallbackUrl.trim()}
            >
              {isPending ? "Working..." : "Finish connecting"}
            </button>
          </div>
          <details style={{ marginTop: "10px" }}>
            <summary className="atlas-note" style={{ cursor: "pointer" }}>
              Advanced: enter the code and state manually
            </summary>
            <div className="atlas-form-grid" style={{ marginTop: "10px" }}>
              <label className="atlas-form-field">
                <span>Code</span>
                <input type="text" value={stravaCode} onChange={(event) => setStravaCode(event.target.value)} />
              </label>
              <label className="atlas-form-field">
                <span>State</span>
                <input type="text" value={stravaState} onChange={(event) => setStravaState(event.target.value)} />
              </label>
            </div>
          </details>
        </div>
      ) : null}

      {integration.connected ? (
        <dl className="atlas-detail-list">
          {connectorKey === "strava" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>Synced athlete</dt>
                <dd>{runtimeText("athlete_name") ?? "Not yet synced"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Synced activities</dt>
                <dd>{runtimeText("synced_activity_count") ?? "0"}</dd>
              </div>
            </>
          ) : null}
          {connectorKey === "samsung_health" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>Connected device</dt>
                <dd>{runtimeText("connected_device_label") ?? "Not set"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Synced sessions</dt>
                <dd>{runtimeText("synced_session_count") ?? "0"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Sleep hours</dt>
                <dd>{runtimeText("sleep_hours") ?? "Unavailable"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Resting heart rate</dt>
                <dd>{runtimeText("resting_hr") ?? "Unavailable"}</dd>
              </div>
            </>
          ) : null}
          {connectorKey === "health_connect" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>Connected device</dt>
                <dd>{runtimeText("connected_device_label") ?? "Not set"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Synced sessions</dt>
                <dd>{runtimeText("synced_session_count") ?? "0"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Daily steps</dt>
                <dd>{runtimeText("step_count") ?? "Unavailable"}</dd>
              </div>
            </>
          ) : null}
          <div className="atlas-detail-list__row">
            <dt>Last sync</dt>
            <dd>{integration.lastSyncAt ?? "Not yet run"}</dd>
          </div>
        </dl>
      ) : null}

      <details>
        <summary className="atlas-note" style={{ cursor: "pointer" }}>
          Advanced: connection diagnostics
        </summary>
        <dl className="atlas-detail-list" style={{ marginTop: "10px" }}>
          <div className="atlas-detail-list__row">
            <dt>Connected</dt>
            <dd>{integration.connected ? "Yes" : "No"}</dd>
          </div>
          {connectorKey === "strava" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>Sign-in token ready</dt>
                <dd>{integration.runtimeSummary.token_ready ? "Yes" : "No"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Refresh token ready</dt>
                <dd>{integration.runtimeSummary.refresh_ready ? "Yes" : "No"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Callback captured</dt>
                <dd>{integration.runtimeSummary.token_exchange_ready ? "Yes" : "No"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Last token refresh</dt>
                <dd>{runtimeText("last_token_refresh_at") ?? "Not yet refreshed"}</dd>
              </div>
            </>
          ) : null}
          {connectorKey === "samsung_health" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>App permission granted</dt>
                <dd>{integration.runtimeSummary.consent_granted ? "Yes" : "No"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Sync mode</dt>
                <dd>{runtimeText("sync_mode") ?? "sdk-local-stub"}</dd>
              </div>
            </>
          ) : null}
          {connectorKey === "health_connect" ? (
            <>
              <div className="atlas-detail-list__row">
                <dt>Device permission granted</dt>
                <dd>{integration.runtimeSummary.permission_granted ? "Yes" : "No"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Sync mode</dt>
                <dd>{runtimeText("sync_mode") ?? "permissions-local-stub"}</dd>
              </div>
            </>
          ) : null}
          <div className="atlas-detail-list__row">
            <dt>Last save location</dt>
            <dd>{lastSource === "api" ? "This device" : "Not saved (offline)"}</dd>
          </div>
          <div className="atlas-detail-list__row">
            <dt>Official docs</dt>
            <dd>
              <a href={integration.docUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </dd>
          </div>
        </dl>
      </details>

      <div className="atlas-control-card__actions">
        {!integration.connected ? (
          <button type="button" className="atlas-button atlas-button--primary" onClick={connect} disabled={isPending}>
            {isPending ? "Working..." : "Connect"}
          </button>
        ) : null}
        {connectorKey === "strava" ? (
          <button type="button" className="atlas-button" onClick={sync} disabled={isPending || !integration.connected}>
            Sync now
          </button>
        ) : integration.connected ? (
          <p className="atlas-note">
            Synced from the paired phone. See the{" "}
            {onPairDeviceClick ? (
              <button type="button" className="atlas-link-button" onClick={onPairDeviceClick}>
                Pair your device
              </button>
            ) : (
              "Pair your device"
            )}{" "}
            step.
          </p>
        ) : null}
        {integration.connected ? (
          <button type="button" className="atlas-button atlas-button--secondary" onClick={disconnect} disabled={isPending}>
            Disconnect
          </button>
        ) : null}
      </div>

      {status ? <p className="atlas-note">{status}</p> : null}
    </Wrapper>
  );
}
