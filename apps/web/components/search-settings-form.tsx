"use client";

import { useState, useTransition } from "react";

import type { ApiDataSource } from "@/lib/api";
import type { SearchSettingsData } from "@/lib/settings-data";
import { saveSearchSettings } from "@/lib/settings-data";

type SearchSettingsFormProps = {
  initialSettings: SearchSettingsData;
  initialSource: ApiDataSource;
};

export function SearchSettingsForm({ initialSettings, initialSource }: SearchSettingsFormProps) {
  const [settings, setSettings] = useState<SearchSettingsData>(initialSettings);
  const [braveApiKey, setBraveApiKey] = useState("");
  const [clearBraveApiKey, setClearBraveApiKey] = useState(false);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [status, setStatus] = useState("Optional - only needed if OpenFoodFacts doesn't have a product.");
  const [isSaving, startSaveTransition] = useTransition();

  function save() {
    startSaveTransition(async () => {
      const result = await saveSearchSettings({ braveApiKey, clearBraveApiKey });
      setSettings(result.data);
      setBraveApiKey("");
      setClearBraveApiKey(false);
      setLastSource(result.source);
      setStatus(
        result.source === "api"
          ? "Saved to the local Atlas runtime on this device."
          : "Backend unavailable, so the page stayed in stub fallback mode."
      );
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Nutrition search fallback</div>
      <p className="atlas-note">
        OpenFoodFacts is the primary nutrition data source and needs no key. Adding a Brave Search
        API key lets Atlas fall back to a web search when OpenFoodFacts doesn&apos;t have a
        product - entirely optional. The key is sent directly from this device to Brave&apos;s
        API over HTTPS, never through an Atlas-hosted relay, and never logged - same guarantee as
        the Ollama and Groq keys above.
      </p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Brave Search API key</span>
          <input
            type="password"
            value={braveApiKey}
            onChange={(event) => setBraveApiKey(event.target.value)}
            placeholder={settings.braveApiKeySet ? "Key already stored - leave blank to keep it" : "BSA..."}
          />
        </label>
      </div>

      <div className="atlas-detail-list">
        <div className="atlas-detail-list__row">
          <dt>Brave key stored</dt>
          <dd>{settings.braveApiKeySet ? "Yes" : "No"}</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Last save source</dt>
          <dd>{lastSource === "api" ? "Local API" : "Stub fallback"}</dd>
        </div>
      </div>

      <label className="atlas-control-card">
        <div className="atlas-control-card__content">
          <div className="atlas-control-card__title">Clear stored Brave key</div>
          <div className="atlas-control-card__meta">
            Removes the key and disables the search fallback - OpenFoodFacts keeps working as
            normal.
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
        {isSaving ? "Saving..." : "Save search settings"}
      </button>

      <p className="atlas-note">{status}</p>
    </section>
  );
}
