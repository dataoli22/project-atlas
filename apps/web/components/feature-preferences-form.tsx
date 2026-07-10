"use client";

import { useMemo, useState, useTransition } from "react";

import type { AppPreference, AtlasFeature } from "@atlas/shared";

import type { ApiDataSource } from "@/lib/api";
import type { FeatureSummary } from "@/lib/settings-data";
import { saveAppPreferences } from "@/lib/settings-data";

type FeaturePreferencesFormProps = {
  initialFeatures: FeatureSummary[];
  initialPreferences: AppPreference;
  initialSource: ApiDataSource;
};

function formatFeatureLabel(feature: AtlasFeature) {
  return feature === "endurance" ? "Endurance" : "Nutrition";
}

export function FeaturePreferencesForm({
  initialFeatures,
  initialPreferences,
  initialSource
}: FeaturePreferencesFormProps) {
  const availableFeatures = useMemo(
    () => initialFeatures.filter((feature) => feature.enabled).map((feature) => feature.key),
    [initialFeatures]
  );
  const [preferences, setPreferences] = useState<AppPreference>(initialPreferences);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [status, setStatus] = useState("Feature settings are ready to save.");
  const [isPending, startTransition] = useTransition();

  const enabledSet = new Set(preferences.enabledFeatureFlags);

  function toggleFeature(feature: AtlasFeature) {
    setPreferences((current) => {
      const currentlyEnabled = new Set(current.enabledFeatureFlags);

      if (currentlyEnabled.has(feature)) {
        if (currentlyEnabled.size === 1) {
          setStatus("At least one feature must remain enabled.");
          return current;
        }

        currentlyEnabled.delete(feature);
        const nextActive =
          current.activeFeature === feature ? Array.from(currentlyEnabled)[0] : current.activeFeature;

        return {
          ...current,
          activeFeature: nextActive,
          enabledFeatureFlags: Array.from(currentlyEnabled)
        };
      }

      currentlyEnabled.add(feature);
      return {
        ...current,
        enabledFeatureFlags: Array.from(currentlyEnabled)
      };
    });
  }

  function setActiveFeature(feature: AtlasFeature) {
    if (!enabledSet.has(feature)) {
      setStatus("Enable a feature before making it the active workspace.");
      return;
    }

    setPreferences((current) => ({
      ...current,
      activeFeature: feature
    }));
  }

  function savePreferences() {
    startTransition(async () => {
      const result = await saveAppPreferences(preferences);
      setPreferences(result.data);
      setLastSource(result.source);
      window.dispatchEvent(
        new CustomEvent("atlas:preferences-updated", {
          detail: result.data
        })
      );
      setStatus(
        result.source === "api"
          ? "Saved through the shared API."
          : "Backend unavailable, so stub fallback was used locally."
      );
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Feature visibility and active workspace</div>
      <div className="atlas-stack">
        {availableFeatures.map((feature) => {
          const checked = enabledSet.has(feature);
          const active = preferences.activeFeature === feature;

          return (
            <label key={feature} className="atlas-control-card">
              <div className="atlas-control-card__content">
                <div className="atlas-control-card__title">{formatFeatureLabel(feature)}</div>
                <div className="atlas-control-card__meta">
                  {checked ? "Enabled in shell" : "Hidden from shell"}
                  {active ? " | Active workspace" : ""}
                </div>
              </div>
              <div className="atlas-control-card__actions">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFeature(feature)}
                  aria-label={`Enable ${formatFeatureLabel(feature)}`}
                />
                <button
                  type="button"
                  className={active ? "atlas-button atlas-button--active" : "atlas-button"}
                  onClick={() => setActiveFeature(feature)}
                  disabled={!checked}
                >
                  Make active
                </button>
              </div>
            </label>
          );
        })}
      </div>

      <dl className="atlas-detail-list">
        <div className="atlas-detail-list__row">
          <dt>Shell density</dt>
          <dd>{preferences.preferredPlatformDensity}</dd>
        </div>

        <div className="atlas-detail-list__row">
          <dt>Last save source</dt>
          <dd>{lastSource === "api" ? "API" : "Stub fallback"}</dd>
        </div>
      </dl>

      <p className="atlas-note">{status}</p>

      <button
        type="button"
        className="atlas-button atlas-button--primary"
        onClick={savePreferences}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save feature settings"}
      </button>
    </section>
  );
}
