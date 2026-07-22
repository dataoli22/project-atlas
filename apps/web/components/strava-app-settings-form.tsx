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
  /** Omits the outer panel chrome and intro copy, for composing inside a parent panel that
   * already explains what this form is for (e.g. the Setup wizard's combined Strava step). */
  embedded?: boolean;
};

export function StravaAppSettingsForm({ initialSettings, initialSource, embedded = false }: StravaAppSettingsFormProps) {
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
      setStatus(result.source === "api" ? "Saved." : "Could not reach the local app. Try again.");
      setClientId("");
      setClientSecret("");
    });
  }

  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper className={embedded ? "atlas-stack" : "atlas-panel atlas-stack"}>
      {!embedded ? (
        <>
          <div
            className="atlas-panel__eyebrow"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            Strava API app
            <HintTooltip label="How to register a Strava app">
              Create a free app in Strava&apos;s developer settings, then copy its Client ID and
              Client Secret here. Set the app&apos;s &quot;Authorization Callback Domain&quot; to
              match where this instance of Atlas runs.{" "}
              <a href={STRAVA_APP_SETTINGS_URL} target="_blank" rel="noreferrer">
                Register an app
              </a>
            </HintTooltip>
          </div>
          <p className="atlas-note">
            Strava requires each installation to register its own API app; there is no shared
            Atlas app ID. Without this configured, the Strava connector remains available but
            sign-in and sync will fail. As with other credentials, this key is sent directly from
            this device to Strava and never passes through an Atlas server.
          </p>
        </>
      ) : (
        <div className="atlas-list-card__title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          Step 1: Register your Strava API app
          <HintTooltip label="Why this step exists">
            Strava requires each installation to register its own API app; there is no shared
            Atlas app ID.{" "}
            <a href={STRAVA_APP_SETTINGS_URL} target="_blank" rel="noreferrer">
              Register an app
            </a>
          </HintTooltip>
        </div>
      )}

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
            placeholder={settings.clientIdSet ? "Already saved. Enter a new value to replace it." : "e.g. 123456"}
          />
        </label>
        <label className="atlas-form-field">
          <span>Client Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder={settings.clientSecretSet ? "Already saved. Enter a new value to replace it." : "Client secret"}
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
    </Wrapper>
  );
}
