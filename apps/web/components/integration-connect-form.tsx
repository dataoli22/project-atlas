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
  const [selectedKey, setSelectedKey] = useState<IntegrationSourceData["key"]>(initialIntegrations[0]?.key ?? "strava");
  const [accountLabel, setAccountLabel] = useState("");
  const [stravaCallbackUrl, setStravaCallbackUrl] = useState("");
  const [stravaCode, setStravaCode] = useState("");
  const [stravaState, setStravaState] = useState("");
  const [stravaLaunchUrl, setStravaLaunchUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [isPending, startTransition] = useTransition();

  const selected =
    integrations.find((integration) => integration.key === selectedKey) ?? integrations[0];
  const selectedInfo = CONNECTOR_INFO.find((connector) => connector.key === selected?.key);
  const selectedFullyConnected = selected ? isFullyConnected(selected) : false;
  const selectedPendingNote = selected ? pendingConnectionNote(selected) : null;

  function replaceIntegration(next: IntegrationSourceData) {
    setIntegrations((current) =>
      current.map((integration) =>
        integration.key === next.key ? next : integration
      )
    );
  }

  function connectSelected() {
    if (!selected) {
      return;
    }

    startTransition(async () => {
      const result = await connectIntegrationSource({ source: selected.key, accountLabel });

      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStravaLaunchUrl(result.data.launchUrl);
      setStatus(
        result.source === "api"
          ? selected.key === "strava"
            ? "Connected. Now finish signing in below."
            : "Connected."
          : "Couldn't reach the local app - try again."
      );
      setAccountLabel("");
    });
  }

  function finishStravaSignIn() {
    if (!selected || selected.key !== "strava") {
      return;
    }

    const value = stravaCallbackUrl.trim();
    if (!value) {
      setStatus("Paste the link Strava sent you back to first.");
      return;
    }

    let code = stravaCode.trim();
    let state = stravaState.trim();

    try {
      const parsedUrl = new URL(value);
      code = parsedUrl.searchParams.get("code")?.trim() ?? code;
      state = parsedUrl.searchParams.get("state")?.trim() ?? state;
    } catch {
      setStatus("That doesn't look like a full link. Paste the whole address Strava sent you back to.");
      return;
    }

    if (!code || !state) {
      setStatus("That link is missing something Strava normally includes. Try signing in again.");
      return;
    }

    startTransition(async () => {
      const callbackResult = await completeStravaCallback({ code, state });

      if (callbackResult.source !== "api") {
        setStatus("Couldn't reach the local app - try again.");
        return;
      }

      const exchangeResult = await exchangeStravaTokens();
      replaceIntegration(exchangeResult.data.integration);
      setLastSource(exchangeResult.source);
      setStatus(exchangeResult.source === "api" ? "Strava is fully connected." : "Signed in, but activating the connection failed - try again.");
      setStravaCallbackUrl("");
      setStravaCode("");
      setStravaState("");
    });
  }

  function disconnectSelected() {
    if (!selected) {
      return;
    }

    const confirmed = window.confirm(`Disconnect ${selected.title}? This removes its saved login and synced data.`);
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectIntegrationSource(selected.key);
      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(result.source === "api" ? `${result.data.integration.title} disconnected.` : "Couldn't reach the local app - try again.");
      setAccountLabel("");
    });
  }

  function syncSelected() {
    if (!selected) {
      return;
    }

    startTransition(async () => {
      const result = await syncIntegrationSource(selected.key);
      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(result.source === "api" ? `${result.data.integration.title} synced.` : "Couldn't reach the local app - try again.");
    });
  }

  function getRuntimeText(key: string) {
    if (!selected) {
      return null;
    }

    const value = selected.runtimeSummary[key];
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return String(value);
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Health apps</div>
      <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
        Strava&apos;s sign-in and sync are real, working code - it just needs a Strava API app
        registered first (see &quot;Strava API app&quot; below). Health Connect and Samsung Health
        are further behind: the phone-side code that would read them hasn&apos;t been built or
        tested on a real device yet, so those two won&apos;t work end-to-end today no matter what
        you configure.
      </p>
      <p className="atlas-note">
        Connecting an app brings in real activities, sleep, and recovery data instead of samples.
        Entirely optional.
      </p>

      <div className="atlas-feature-switcher" aria-label="Health app selector">
        {CONNECTOR_INFO.map((connector) => {
          const active = connector.key === selected?.key;
          const integration = integrations.find((item) => item.key === connector.key);
          const connected = integration ? isFullyConnected(integration) : false;
          return (
            <button
              key={connector.key}
              type="button"
              className={active ? "atlas-button atlas-button--active" : "atlas-button"}
              onClick={() => setSelectedKey(connector.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <connector.icon size={15} strokeWidth={2} aria-hidden="true" />
              {connector.title}
              {connected ? <span style={{ color: "var(--atlas-accent)" }}>&#10003;</span> : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <>
          <div className="atlas-list-card">
            <div
              className="atlas-list-card__title"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {selected.title}
              {selectedInfo ? <HintTooltip label={selectedInfo.hintLabel}>{selectedInfo.hint}</HintTooltip> : null}
            </div>
            <div className="atlas-list-card__meta">{selectedInfo?.detail ?? selected.loginHint}</div>
            <div className="atlas-meta">
              <span className={selectedFullyConnected ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
                {selectedFullyConnected ? "Connected" : selected.connected ? "Pending" : "Not connected"}
              </span>
            </div>
            {selectedPendingNote ? <p className="atlas-note">{selectedPendingNote}</p> : null}
            {selected.accountLabel ? (
              <div className="atlas-list-card__meta">Label: {selected.accountLabel}</div>
            ) : null}
          </div>

          {!selected.connected ? (
            <div className="atlas-form-grid">
              <label className="atlas-form-field">
                <span>Name this connection (optional)</span>
                <input
                  type="text"
                  value={accountLabel}
                  onChange={(event) => setAccountLabel(event.target.value)}
                  placeholder="My phone, Galaxy Watch..."
                />
              </label>
            </div>
          ) : null}

          {selected.key === "strava" && selected.connected && !selected.runtimeSummary.token_exchange_ready ? (
            <div className="atlas-list-card">
              <div className="atlas-list-card__title">Finish signing in to Strava</div>
              <div className="atlas-list-card__meta">
                Open the link below, sign in to Strava, then copy the address you land on back here.
              </div>
              {stravaLaunchUrl ? (
                <div className="atlas-list-card__meta" style={{ marginTop: "8px" }}>
                  <a href={stravaLaunchUrl} target="_blank" rel="noreferrer" className="atlas-button atlas-button--secondary">
                    Open Strava sign-in
                  </a>
                </div>
              ) : null}
              <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                <span>Paste the link Strava sent you back to</span>
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

          {selected.connected ? (
            <dl className="atlas-detail-list">
              {selected.key === "strava" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>Synced athlete</dt>
                    <dd>{getRuntimeText("athlete_name") ?? "Not yet synced"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Synced activities</dt>
                    <dd>{getRuntimeText("synced_activity_count") ?? "0"}</dd>
                  </div>
                </>
              ) : null}
              {selected.key === "samsung_health" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>Connected device</dt>
                    <dd>{getRuntimeText("connected_device_label") ?? "Not set"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Synced sessions</dt>
                    <dd>{getRuntimeText("synced_session_count") ?? "0"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Sleep hours</dt>
                    <dd>{getRuntimeText("sleep_hours") ?? "Unavailable"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Resting heart rate</dt>
                    <dd>{getRuntimeText("resting_hr") ?? "Unavailable"}</dd>
                  </div>
                </>
              ) : null}
              {selected.key === "health_connect" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>Connected device</dt>
                    <dd>{getRuntimeText("connected_device_label") ?? "Not set"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Synced sessions</dt>
                    <dd>{getRuntimeText("synced_session_count") ?? "0"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Daily steps</dt>
                    <dd>{getRuntimeText("step_count") ?? "Unavailable"}</dd>
                  </div>
                </>
              ) : null}
              <div className="atlas-detail-list__row">
                <dt>Last sync</dt>
                <dd>{selected.lastSyncAt ?? "Not yet run"}</dd>
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
                <dd>{selected.connected ? "Yes" : "No"}</dd>
              </div>
              {selected.key === "strava" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>Sign-in token ready</dt>
                    <dd>{selected.runtimeSummary.token_ready ? "Yes" : "No"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Refresh token ready</dt>
                    <dd>{selected.runtimeSummary.refresh_ready ? "Yes" : "No"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Callback captured</dt>
                    <dd>{selected.runtimeSummary.token_exchange_ready ? "Yes" : "No"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Last token refresh</dt>
                    <dd>{getRuntimeText("last_token_refresh_at") ?? "Not yet refreshed"}</dd>
                  </div>
                </>
              ) : null}
              {selected.key === "samsung_health" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>App permission granted</dt>
                    <dd>{selected.runtimeSummary.consent_granted ? "Yes" : "No"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Sync mode</dt>
                    <dd>{getRuntimeText("sync_mode") ?? "sdk-local-stub"}</dd>
                  </div>
                </>
              ) : null}
              {selected.key === "health_connect" ? (
                <>
                  <div className="atlas-detail-list__row">
                    <dt>Device permission granted</dt>
                    <dd>{selected.runtimeSummary.permission_granted ? "Yes" : "No"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Sync mode</dt>
                    <dd>{getRuntimeText("sync_mode") ?? "permissions-local-stub"}</dd>
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
                  <a href={selected.docUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </dd>
              </div>
            </dl>
          </details>

          <div className="atlas-control-card__actions">
            {!selected.connected ? (
              <button
                type="button"
                className="atlas-button atlas-button--primary"
                onClick={connectSelected}
                disabled={isPending}
              >
                {isPending ? "Working..." : "Connect"}
              </button>
            ) : null}
            {selected.key === "strava" ? (
              <button
                type="button"
                className="atlas-button"
                onClick={syncSelected}
                disabled={isPending || !selected.connected}
              >
                Sync now
              </button>
            ) : selected.connected ? (
              <p className="atlas-note">Syncs from your paired phone, not from here - see Phone pairing below.</p>
            ) : null}
            {selected.connected ? (
              <button
                type="button"
                className="atlas-button atlas-button--secondary"
                onClick={disconnectSelected}
                disabled={isPending}
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {status ? <p className="atlas-note">{status}</p> : null}
    </section>
  );
}
