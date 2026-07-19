"use client";

import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import type { ApiDataSource } from "@/lib/api";
import type { StravaAppSettingsData } from "@/lib/settings-data";
import { saveStravaAppSettings } from "@/lib/settings-data";

const STRAVA_APP_SETTINGS_URL = "https://www.strava.com/settings/api";

type StravaAppSettingsFormProps = {
  initialSettings: StravaAppSettingsData;
  initialSource: ApiDataSource;
};

export function StravaAppSettingsForm({ initialSettings, initialSource }: StravaAppSettingsFormProps) {
  const [settings, setSettings] = useState<StravaAppSettingsData>(initialSettings);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [isSaving, startTransition] = useTransition();

  const configured = settings.clientIdSet && settings.clientSecretSet;

  function save() {
    startTransition(async () => {
      const result = await saveStravaAppSettings({ clientId, clientSecret });
      setSettings(result.data);
      setLastSource(result.source);
      setStatus(result.source === "api" ? "Saved." : "Couldn't reach the local app - try again.");
      setClientId("");
      setClientSecret("");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div
        className="atlas-panel__eyebrow"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        Strava API app
        <HintTooltip label="How to register a Strava app">
          Create a free app at Strava&apos;s developer settings, then copy its Client ID and
          Client Secret here. Set the app&apos;s &quot;Authorization Callback Domain&quot; to
          match where this instance of Atlas runs.{" "}
          <a href={STRAVA_APP_SETTINGS_URL} target="_blank" rel="noreferrer">
            Register an app
          </a>
        </HintTooltip>
      </div>
      <p className="atlas-note">
        Strava requires every installation to register its own app - there&apos;s no shared Atlas
        app ID to reuse. Without this, the Strava connector stays staged locally but sign-in and
        sync will fail. Same guarantee as your other keys: sent straight from this device to
        Strava, never through an Atlas server.
      </p>

      <div className="atlas-meta">
        <span className={configured ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Client ID</span>
          <input
            type="text"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={settings.clientIdSet ? "Already saved - enter a new one to replace it" : "e.g. 123456"}
          />
        </label>
        <label className="atlas-form-field">
          <span>Client Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={settings.clientSecretSet ? "Already saved - enter a new one to replace it" : "Client secret"}
          />
        </label>
      </div>

      <dl className="atlas-detail-list">
        <div className="atlas-detail-list__row">
          <dt>Callback URL to register with Strava</dt>
          <dd>{settings.redirectUri || "Not set"}</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Requested access</dt>
          <dd>{settings.scopes}</dd>
        </div>
      </dl>

      <button type="button" className="atlas-button atlas-button--primary" onClick={save} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </button>

      {status ? <p className="atlas-note">{status}</p> : null}
    </section>
  );
}
