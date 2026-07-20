"use client";

import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import type { ApiDataSource } from "@/lib/api";
import type { SearchSettingsData } from "@/lib/settings-data";
import { saveSearchSettings } from "@/lib/settings-data";

const BRAVE_KEYS_URL = "https://api.search.brave.com/app/keys";

type SearchSettingsFormProps = {
  initialSettings: SearchSettingsData;
  initialSource: ApiDataSource;
};

export function SearchSettingsForm({ initialSettings, initialSource }: SearchSettingsFormProps) {
  const [settings, setSettings] = useState<SearchSettingsData>(initialSettings);
  const [braveApiKey, setBraveApiKey] = useState("");
  const [clearBraveApiKey, setClearBraveApiKey] = useState(false);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  function save() {
    startSaveTransition(async () => {
      const result = await saveSearchSettings({ braveApiKey, clearBraveApiKey });
      setSettings(result.data);
      setBraveApiKey("");
      setClearBraveApiKey(false);
      setLastSource(result.source);
      setStatus(result.source === "api" ? "Saved." : "Could not reach the local app. Try again.");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div
        className="atlas-panel__eyebrow"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        Web search
        <HintTooltip label="How to get a Brave Search key">
          Create a free Brave Search API account, then copy your API key from the dashboard.{" "}
          <a href={BRAVE_KEYS_URL} target="_blank" rel="noreferrer">
            Get a key
          </a>
        </HintTooltip>
      </div>
      <p className="atlas-note">
        Used to fill gaps when a food is not yet in Atlas&apos;s product database. Configured
        during onboarding; replace or remove the key here at any time. As with other credentials,
        this key is sent directly from this device to Brave and never passes through Atlas.
      </p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Brave Search API key</span>
          <input
            type="password"
            value={braveApiKey}
            onChange={(event) => setBraveApiKey(event.target.value)}
            placeholder={settings.braveApiKeySet ? "Key already saved. Leave blank to keep it." : "Brave Search API key"}
          />
        </label>
      </div>

      <div className="atlas-meta">
        <span className={settings.braveApiKeySet ? "atlas-source-badge" : "atlas-source-badge atlas-source-badge--stub"}>
          {settings.braveApiKeySet ? "Key saved" : "No key saved"}
        </span>
      </div>

      <label className="atlas-control-card">
        <div className="atlas-control-card__content">
          <div className="atlas-control-card__title">Remove saved key</div>
          <div className="atlas-control-card__meta">
            Disables web search. Atlas continues using its product database as normal.
          </div>
        </div>
        <div className="atlas-control-card__actions">
          <input
            type="checkbox"
            checked={clearBraveApiKey}
            onChange={(event) => setClearBraveApiKey(event.target.checked)}
          />
        </div>
      </label>

      <button type="button" className="atlas-button atlas-button--primary" onClick={save} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </button>

      {status ? <p className="atlas-note">{status}</p> : null}
    </section>
  );
}
