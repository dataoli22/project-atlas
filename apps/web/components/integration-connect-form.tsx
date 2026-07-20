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

type IntegrationConnectFormProps = {
  initialIntegrations: IntegrationSourceData[];
  initialSource: ApiDataSource;
};

export function IntegrationConnectForm({
  initialIntegrations,
  initialSource
}: IntegrationConnectFormProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [accountLabels, setAccountLabels] = useState<Record<string, string>>({});
  const [stravaCallbackUrl, setStravaCallbackUrl] = useState("");
  const [stravaCode, setStravaCode] = useState("");
  const [stravaState, setStravaState] = useState("");
  const [stravaLaunchUrl, setStravaLaunchUrl] = useState<string | null>(null);
  const [statusByKey, setStatusByKey] = useState<Record<string, string | null>>({});
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function replaceIntegration(next: IntegrationSourceData) {
    setIntegrations((current) =>
      current.map((integration) =>
        integration.key === next.key ? next : integration
      )
    );
  }

  function setStatus(key: string, message: string) {
    setStatusByKey((current) => ({ ...current, [key]: message }));
  }

  function connect(key: IntegrationSourceData["key"]) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await connectIntegrationSource({ source: key, accountLabel: accountLabels[key] ?? "" });

      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStravaLaunchUrl(result.data.launchUrl);
      setStatus(
        key,
        result.source === "api"
          ? key === "strava"
            ? "Connected. Finish signing in below to complete setup."
            : "Connected."
          : "Could not reach the local app. Try again."
      );
      setAccountLabels((current) => ({ ...current, [key]: "" }));
      setPendingKey(null);
    });
  }

  function finishStravaSignIn() {
    const value = stravaCallbackUrl.trim();
    if (!value) {
      setStatus("strava", "Enter the redirect URL Strava returned before continuing.");
      return;
    }

    let code = stravaCode.trim();
    let state = stravaState.trim();

    try {
      const parsedUrl = new URL(value);
      code = parsedUrl.searchParams.get("code")?.trim() ?? code;
      state = parsedUrl.searchParams.get("state")?.trim() ?? state;
    } catch {
      setStatus("strava", "This does not appear to be a valid URL. Enter the full redirect address Strava returned.");
      return;
    }

    if (!code || !state) {
      setStatus("strava", "The redirect URL is missing required parameters. Sign in again.");
      return;
    }

    setPendingKey("strava");
    startTransition(async () => {
      const callbackResult = await completeStravaCallback({ code, state });

      if (callbackResult.source !== "api") {
        setStatus("strava", "Could not reach the local app. Try again.");
        setPendingKey(null);
        return;
      }

      const exchangeResult = await exchangeStravaTokens();
      replaceIntegration(exchangeResult.data.integration);
      setLastSource(exchangeResult.source);
      setStatus(
        "strava",
        exchangeResult.source === "api" ? "Strava connected successfully." : "Signed in, but activation failed. Try again."
      );
      setStravaCallbackUrl("");
      setStravaCode("");
      setStravaState("");
      setPendingKey(null);
    });
  }

  function disconnect(integration: IntegrationSourceData) {
    const confirmed = window.confirm(`Disconnect ${integration.title}? This removes its saved login and synced data.`);
    if (!confirmed) {
      return;
    }

    setPendingKey(integration.key);
    startTransition(async () => {
      const result = await disconnectIntegrationSource(integration.key);
      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(
        integration.key,
        result.source === "api" ? `${result.data.integration.title} disconnected.` : "Could not reach the local app. Try again."
      );
      setAccountLabels((current) => ({ ...current, [integration.key]: "" }));
      setPendingKey(null);
    });
  }

  function sync(integration: IntegrationSourceData) {
    setPendingKey(integration.key);
    startTransition(async () => {
      const result = await syncIntegrationSource(integration.key);
      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(
        integration.key,
        result.source === "api" ? `${result.data.integration.title} synced.` : "Could not reach the local app. Try again."
      );
      setPendingKey(null);
    });
  }

  function getRuntimeText(integration: IntegrationSourceData, key: string) {
    const value = integration.runtimeSummary[key];
    if (value === null || value === undefined || value === "") {
      return null;
    }
    return String(value);
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Health apps</div>
      <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
        Strava sign-in and sync are fully implemented but require a registered Strava API app
        (see &quot;Strava API app&quot; below). Health Connect and Samsung Health are in
        development: the device-side code required to read them has not yet been built or
        tested on hardware, so these two integrations do not function end-to-end at this time.
      </p>
      <p className="atlas-note">
        Connecting an app replaces sample data with real activities, sleep, and recovery data.
        This step is optional.
      </p>

      <div className="atlas-grid atlas-grid--connectors">
        {CONNECTOR_INFO.map((connector) => {
          const integration = integrations.find((item) => item.key === connector.key) ?? integrations[0];
          if (!integration) {
            return null;
          }
          const fullyConnected = isFullyConnected(integration);
          const pendingNote = pendingConnectionNote(integration);
          const busy = isPending && pendingKey === connector.key;
          const status = statusByKey[connector.key];

          return (
            <div key={connector.key} id={`connector-${connector.key}`} className="atlas-list-card">
              <div
                className="atlas-list-card__title"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <connector.icon size={16} strokeWidth={2} aria-hidden="true" />
                {connector.title}
                <HintTooltip label={connector.hintLabel}>{connector.hint}</HintTooltip>
              </div>
              <div className="atlas-list-card__meta">{connector.detail}</div>
              <p className="atlas-note" style={{ marginTop: "6px" }}>
                {connector.hint}
              </p>

              <div className="atlas-meta" style={{ marginTop: "8px" }}>
                <span className={fullyConnected ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
                  {fullyConnected ? "Connected" : integration.connected ? "Pending" : "Not connected"}
                </span>
              </div>
              {pendingNote ? <p className="atlas-note">{pendingNote}</p> : null}
              {integration.accountLabel ? (
                <div className="atlas-list-card__meta">Label: {integration.accountLabel}</div>
              ) : null}

              {!integration.connected ? (
                <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                  <span>Name this connection (optional)</span>
                  <input
                    type="text"
                    value={accountLabels[connector.key] ?? ""}
                    onChange={(event) =>
                      setAccountLabels((current) => ({ ...current, [connector.key]: event.target.value }))
                    }
                    placeholder="My phone, Galaxy Watch..."
                  />
                </div>
              ) : null}

              {connector.key === "strava" && integration.connected && !integration.runtimeSummary.token_exchange_ready ? (
                <div className="atlas-list-card" style={{ marginTop: "10px" }}>
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
                      disabled={busy || !stravaCallbackUrl.trim()}
                    >
                      {busy ? "Working..." : "Finish connecting"}
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
                <dl className="atlas-detail-list" style={{ marginTop: "10px" }}>
                  {connector.key === "strava" ? (
                    <>
                      <div className="atlas-detail-list__row">
                        <dt>Synced athlete</dt>
                        <dd>{getRuntimeText(integration, "athlete_name") ?? "Not yet synced"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Synced activities</dt>
                        <dd>{getRuntimeText(integration, "synced_activity_count") ?? "0"}</dd>
                      </div>
                    </>
                  ) : null}
                  {connector.key === "samsung_health" ? (
                    <>
                      <div className="atlas-detail-list__row">
                        <dt>Connected device</dt>
                        <dd>{getRuntimeText(integration, "connected_device_label") ?? "Not set"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Synced sessions</dt>
                        <dd>{getRuntimeText(integration, "synced_session_count") ?? "0"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Sleep hours</dt>
                        <dd>{getRuntimeText(integration, "sleep_hours") ?? "Unavailable"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Resting heart rate</dt>
                        <dd>{getRuntimeText(integration, "resting_hr") ?? "Unavailable"}</dd>
                      </div>
                    </>
                  ) : null}
                  {connector.key === "health_connect" ? (
                    <>
                      <div className="atlas-detail-list__row">
                        <dt>Connected device</dt>
                        <dd>{getRuntimeText(integration, "connected_device_label") ?? "Not set"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Synced sessions</dt>
                        <dd>{getRuntimeText(integration, "synced_session_count") ?? "0"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Daily steps</dt>
                        <dd>{getRuntimeText(integration, "step_count") ?? "Unavailable"}</dd>
                      </div>
                    </>
                  ) : null}
                  <div className="atlas-detail-list__row">
                    <dt>Last sync</dt>
                    <dd>{integration.lastSyncAt ?? "Not yet run"}</dd>
                  </div>
                </dl>
              ) : null}

              <details style={{ marginTop: "10px" }}>
                <summary className="atlas-note" style={{ cursor: "pointer" }}>
                  Advanced: connection diagnostics
                </summary>
                <dl className="atlas-detail-list" style={{ marginTop: "10px" }}>
                  <div className="atlas-detail-list__row">
                    <dt>Connected</dt>
                    <dd>{integration.connected ? "Yes" : "No"}</dd>
                  </div>
                  {connector.key === "strava" ? (
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
                        <dd>{getRuntimeText(integration, "last_token_refresh_at") ?? "Not yet refreshed"}</dd>
                      </div>
                    </>
                  ) : null}
                  {connector.key === "samsung_health" ? (
                    <>
                      <div className="atlas-detail-list__row">
                        <dt>App permission granted</dt>
                        <dd>{integration.runtimeSummary.consent_granted ? "Yes" : "No"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Sync mode</dt>
                        <dd>{getRuntimeText(integration, "sync_mode") ?? "sdk-local-stub"}</dd>
                      </div>
                    </>
                  ) : null}
                  {connector.key === "health_connect" ? (
                    <>
                      <div className="atlas-detail-list__row">
                        <dt>Device permission granted</dt>
                        <dd>{integration.runtimeSummary.permission_granted ? "Yes" : "No"}</dd>
                      </div>
                      <div className="atlas-detail-list__row">
                        <dt>Sync mode</dt>
                        <dd>{getRuntimeText(integration, "sync_mode") ?? "permissions-local-stub"}</dd>
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

              <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
                {!integration.connected ? (
                  <button
                    type="button"
                    className="atlas-button atlas-button--primary"
                    onClick={() => connect(connector.key)}
                    disabled={busy}
                  >
                    {busy ? "Working..." : "Connect"}
                  </button>
                ) : null}
                {connector.key === "strava" ? (
                  <button
                    type="button"
                    className="atlas-button"
                    onClick={() => sync(integration)}
                    disabled={busy || !integration.connected}
                  >
                    Sync now
                  </button>
                ) : integration.connected ? (
                  <p className="atlas-note">Synced from the paired phone. See Phone pairing below.</p>
                ) : null}
                {integration.connected ? (
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary"
                    onClick={() => disconnect(integration)}
                    disabled={busy}
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>

              {status ? <p className="atlas-note">{status}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
