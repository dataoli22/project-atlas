"use client";

import { useState, useTransition } from "react";

import type { ApiDataSource } from "@/lib/api";
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
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [stravaCallbackUrl, setStravaCallbackUrl] = useState("");
  const [stravaCode, setStravaCode] = useState("");
  const [stravaState, setStravaState] = useState("");
  const [stravaScope, setStravaScope] = useState("");
  const [stravaLaunchUrl, setStravaLaunchUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose a connector to prepare its local-first login or consent flow.");
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [isPending, startTransition] = useTransition();

  const selected =
    integrations.find((integration) => integration.key === selectedKey) ?? integrations[0];

  function replaceIntegration(next: IntegrationSourceData) {
    setIntegrations((current) =>
      current.map((integration) =>
        integration.key === next.key ? next : integration
      )
    );
  }

  function parseStravaCallbackUrl() {
    const value = stravaCallbackUrl.trim();
    if (!value) {
      return;
    }

    try {
      const parsedUrl = new URL(value);
      const code = parsedUrl.searchParams.get("code")?.trim() ?? "";
      const state = parsedUrl.searchParams.get("state")?.trim() ?? "";
      const scope = parsedUrl.searchParams.get("scope")?.trim() ?? "";

      if (!code || !state) {
        setStatus("The pasted callback URL is missing a Strava code or state value.");
        return;
      }

      setStravaCode(code);
      setStravaState(state);
      setStravaScope(scope);
      setStatus("Strava callback URL parsed locally. Review the fields below, then capture the callback.");
    } catch {
      setStatus("Atlas could not parse that callback URL. Paste the full redirected URL or enter code/state manually.");
    }
  }

  function connectSelected() {
    if (!selected) {
      return;
    }

    startTransition(async () => {
      const result = await connectIntegrationSource({
        source: selected.key,
        accountLabel,
        loginIdentifier: selected.connectMode === "oauth" ? loginIdentifier : undefined
      });

      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStravaLaunchUrl(result.data.launchUrl);
      setStatus(
        result.source === "api"
          ? `${result.data.integration.title} is now staged in the local runtime. ${result.data.localOnlyNotice}`
          : "Backend unavailable, so Atlas kept the connector in local stub mode."
      );
      setAccountLabel("");
      setLoginIdentifier("");
    });
  }

  function completeStravaCallbackFlow() {
    if (!selected || selected.key !== "strava") {
      return;
    }

    startTransition(async () => {
      const result = await completeStravaCallback({
        code: stravaCode,
        state: stravaState,
        scope: stravaScope
      });

      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(
        result.source === "api"
          ? `Strava callback captured locally. ${result.data.localOnlyNotice}`
          : "Backend unavailable, so Atlas only simulated local callback capture."
      );
      setStravaCallbackUrl("");
      setStravaCode("");
      setStravaState("");
      setStravaScope("");
    });
  }

  function exchangeStravaTokensFlow() {
    if (!selected || selected.key !== "strava") {
      return;
    }

    startTransition(async () => {
      const result = await exchangeStravaTokens();

      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(
        result.source === "api"
          ? `Strava tokens are now ready in the local runtime. ${result.data.localOnlyNotice}`
          : "Backend unavailable, so Atlas simulated the token exchange locally."
      );
    });
  }

  function disconnectSelected() {
    if (!selected) {
      return;
    }

    const confirmed = window.confirm(
      `Disconnect ${selected.title}? This clears the locally stored tokens and synced data for this connector.`
    );
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectIntegrationSource(selected.key);
      replaceIntegration(result.data.integration);
      setLastSource(result.source);
      setStatus(
        result.source === "api"
          ? `${result.data.integration.title} was disconnected from the local runtime state.`
          : "Backend unavailable, so Atlas reset the local stub state only."
      );
      setAccountLabel("");
      setLoginIdentifier("");
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
      setStatus(
        result.source === "api"
          ? `${result.data.integration.title} ran a replaceable stub sync.`
          : "Backend unavailable, so Atlas simulated the sync locally."
      );
    });
  }

  function loginFieldLabel() {
    if (!selected) {
      return "Login";
    }

    if (selected.key === "strava") {
      return "Strava login email or athlete name";
    }

    if (selected.key === "samsung_health") {
      return "Samsung device or profile label";
    }

    return "Android device label";
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
      <div className="atlas-panel__eyebrow">Health account wiring</div>
      <p className="atlas-note">
        Atlas exposes the connection controls in one place, but each source keeps its real auth model: Strava uses
        OAuth, Health Connect uses Android permissions, and Samsung Health uses SDK consent.
      </p>

      <div className="atlas-feature-switcher" aria-label="Connector selector">
        {integrations.map((integration) => {
          const active = integration.key === selected?.key;
          return (
            <button
              key={integration.key}
              type="button"
              className={active ? "atlas-button atlas-button--active" : "atlas-button"}
              onClick={() => setSelectedKey(integration.key)}
            >
              {integration.title}
            </button>
          );
        })}
      </div>

      {selected ? (
        <>
          <div className="atlas-list-card">
            <div className="atlas-list-card__title">{selected.title}</div>
            <div className="atlas-list-card__meta">{selected.loginHint}</div>
            <div className="atlas-list-card__meta">
              Mode: {selected.connectMode} | Status: {selected.status}
              {selected.accountLabel ? ` | Label: ${selected.accountLabel}` : ""}
            </div>
          </div>

          <div className="atlas-form-grid">
            <label className="atlas-form-field">
              <span>Connection label</span>
              <input
                type="text"
                value={accountLabel}
                onChange={(event) => setAccountLabel(event.target.value)}
                placeholder="Morning training, Pixel phone, Galaxy Watch..."
              />
            </label>

            <label className="atlas-form-field">
              <span>{loginFieldLabel()}</span>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                placeholder={
                  selected.key === "strava"
                    ? "runner@example.com"
                    : selected.key === "samsung_health"
                      ? "Galaxy S device"
                      : "Primary Android device"
                }
                disabled={selected.connectMode !== "oauth"}
              />
            </label>
          </div>

          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Connected</dt>
              <dd>{selected.connected ? "Yes" : "No"}</dd>
            </div>
            {selected.key === "strava" ? (
              <>
                <div className="atlas-detail-list__row">
                  <dt>Token ready</dt>
                  <dd>{selected.runtimeSummary.token_ready ? "Yes" : "No"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Refresh token ready</dt>
                  <dd>{selected.runtimeSummary.refresh_ready ? "Yes" : "No"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Synced athlete</dt>
                  <dd>{getRuntimeText("athlete_name") ?? "Not yet synced"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Callback captured</dt>
                  <dd>{selected.runtimeSummary.token_exchange_ready ? "Yes" : "No"}</dd>
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
                  <dt>SDK consent granted</dt>
                  <dd>{selected.runtimeSummary.consent_granted ? "Yes" : "No"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Connected device</dt>
                  <dd>{getRuntimeText("connected_device_label") ?? "Not set"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Supported metrics</dt>
                  <dd>{getRuntimeText("supported_metric_count") ?? "0"}</dd>
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
                  <dt>Resting HR</dt>
                  <dd>{getRuntimeText("resting_hr") ?? "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Energy score</dt>
                  <dd>{getRuntimeText("energy_score") ?? "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Stress level</dt>
                  <dd>{getRuntimeText("stress_level") ?? "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Sync mode</dt>
                  <dd>{getRuntimeText("sync_mode") ?? "sdk-local-stub"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Bridge source</dt>
                  <dd>{getRuntimeText("bridge_source") ?? "Not imported"}</dd>
                </div>
              </>
            ) : null}
            {selected.key === "health_connect" ? (
              <>
                <div className="atlas-detail-list__row">
                  <dt>Permission granted</dt>
                  <dd>{selected.runtimeSummary.permission_granted ? "Yes" : "No"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Connected device</dt>
                  <dd>{getRuntimeText("connected_device_label") ?? "Not set"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Synced sessions</dt>
                  <dd>{getRuntimeText("synced_session_count") ?? "0"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Hydration baseline</dt>
                  <dd>{getRuntimeText("hydration_ml") ? `${getRuntimeText("hydration_ml")} ml` : "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Body weight</dt>
                  <dd>{getRuntimeText("body_weight_kg") ? `${getRuntimeText("body_weight_kg")} kg` : "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Daily steps</dt>
                  <dd>{getRuntimeText("step_count") ?? "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Active energy</dt>
                  <dd>{getRuntimeText("active_energy_kcal") ? `${getRuntimeText("active_energy_kcal")} kcal` : "Unavailable"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Sync mode</dt>
                  <dd>{getRuntimeText("sync_mode") ?? "permissions-local-stub"}</dd>
                </div>
                <div className="atlas-detail-list__row">
                  <dt>Bridge source</dt>
                  <dd>{getRuntimeText("bridge_source") ?? "Not imported"}</dd>
                </div>
              </>
            ) : null}
            <div className="atlas-detail-list__row">
              <dt>Last sync</dt>
              <dd>{selected.lastSyncAt ?? "Not yet run"}</dd>
            </div>
            {selected.key === "strava" ? (
              <div className="atlas-detail-list__row">
                <dt>Last token refresh</dt>
                <dd>{getRuntimeText("last_token_refresh_at") ?? "Not yet refreshed"}</dd>
              </div>
            ) : null}
            <div className="atlas-detail-list__row">
              <dt>Last API source</dt>
              <dd>{lastSource === "api" ? "Local API" : "Stub fallback"}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Provider docs</dt>
              <dd>
                <a href={selected.docUrl} target="_blank" rel="noreferrer">
                  Open official docs
                </a>
              </dd>
            </div>
          </dl>

          <div className="atlas-stack">
            {selected.notes.map((note) => (
              <div key={note} className="atlas-list-card">
                <div className="atlas-list-card__meta">{note}</div>
              </div>
            ))}
          </div>

          {selected.key === "strava" ? (
            <div className="atlas-stack">
              <div className="atlas-list-card">
                <div className="atlas-list-card__title">Strava local OAuth handoff</div>
                <div className="atlas-list-card__meta">
                  Launch the OAuth URL from the packaged app, then either paste the full redirected callback URL or
                  enter the returned code and state manually if you are testing the local runtime flow.
                </div>
                {stravaLaunchUrl ? (
                  <div className="atlas-list-card__meta">
                    Launch URL: <a href={stravaLaunchUrl} target="_blank" rel="noreferrer">Open Strava OAuth</a>
                  </div>
                ) : null}
              </div>

              <div className="atlas-form-grid">
                <label className="atlas-form-field">
                  <span>Callback URL</span>
                  <input
                    type="text"
                    value={stravaCallbackUrl}
                    onChange={(event) => setStravaCallbackUrl(event.target.value)}
                    placeholder="Paste the full redirected callback URL"
                  />
                </label>
                <label className="atlas-form-field">
                  <span>Callback code</span>
                  <input
                    type="text"
                    value={stravaCode}
                    onChange={(event) => setStravaCode(event.target.value)}
                    placeholder="Paste Strava code"
                  />
                </label>
                <label className="atlas-form-field">
                  <span>Callback state</span>
                  <input
                    type="text"
                    value={stravaState}
                    onChange={(event) => setStravaState(event.target.value)}
                    placeholder="Paste returned state"
                  />
                </label>
                <label className="atlas-form-field">
                  <span>Scope</span>
                  <input
                    type="text"
                    value={stravaScope}
                    onChange={(event) => setStravaScope(event.target.value)}
                    placeholder="read,activity:read_all"
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="atlas-control-card__actions">
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={connectSelected}
              disabled={isPending}
            >
              {isPending ? "Working..." : selected.ctaLabel}
            </button>
            <button
              type="button"
              className="atlas-button"
              onClick={syncSelected}
              disabled={isPending || !selected.connected}
            >
              {selected.key === "strava" ? "Run live sync" : "Run stub sync"}
            </button>
            {selected.key === "strava" ? (
              <button
                type="button"
                className="atlas-button"
                onClick={parseStravaCallbackUrl}
                disabled={isPending || !stravaCallbackUrl.trim()}
              >
                Parse callback URL
              </button>
            ) : null}
            {selected.key === "strava" ? (
              <button
                type="button"
                className="atlas-button"
                onClick={completeStravaCallbackFlow}
                disabled={isPending || !stravaCode.trim() || !stravaState.trim()}
              >
                Capture callback
              </button>
            ) : null}
            {selected.key === "strava" ? (
              <button
                type="button"
                className="atlas-button"
                onClick={exchangeStravaTokensFlow}
                disabled={isPending || !selected.runtimeSummary.token_exchange_ready}
              >
                Exchange tokens
              </button>
            ) : null}
            <button
              type="button"
              className="atlas-button"
              onClick={disconnectSelected}
              disabled={isPending || !selected.connected}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : null}

      <p className="atlas-note">{status}</p>
    </section>
  );
}
