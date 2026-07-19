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
      setStatus(result.source === "api" ? "Saved." : "Couldn't reach the local app - try again.");
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
        Fills the gap when a food isn&apos;t in Atlas&apos;s product database yet. Set up during
        onboarding - this is where you replace or remove that key later. Same guarantee as your
        other keys: it goes straight from this device to Brave, never through Atlas.
      </p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Brave Search API key</span>
          <input
            type="password"
            value={braveApiKey}
            onChange={(event) => setBraveApiKey(event.target.value)}
            placeholder={settings.braveApiKeySet ? "Key already saved - leave blank to keep it" : "Brave Search API key"}
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
            Turns off web search - Atlas keeps using its product database as normal.
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
