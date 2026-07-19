"use client";

import { useMemo, useState, useTransition } from "react";

import type { AppPreference, AtlasFeature } from "@atlas/shared";

import { HintTooltip } from "@/components/hint-tooltip";
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
      setStatus(result.source === "api" ? "Saved." : "Couldn't reach the local app - try again.");
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div
        className="atlas-panel__eyebrow"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        What do you want to see?
        <HintTooltip label="What hiding a section does">
          Only hides it from the navigation menu - your data for that section is kept and comes
          right back if you turn it on again.
        </HintTooltip>
      </div>
      <p className="atlas-note">
        Pick the sections that are relevant to you. You can turn either one back on anytime.
      </p>
      <div className="atlas-stack">
        {availableFeatures.map((feature) => {
          const checked = enabledSet.has(feature);
          const active = preferences.activeFeature === feature;

          return (
            <div key={feature} className="atlas-control-card">
              <div className="atlas-control-card__content">
                <div className="atlas-control-card__title">{formatFeatureLabel(feature)}</div>
                <div className="atlas-control-card__meta">
                  {checked ? "Shown in navigation" : "Hidden from navigation"}
                  {active ? " - this is your default view" : ""}
                </div>
              </div>
              <div className="atlas-control-card__actions">
                <button
                  type="button"
                  className={checked ? "atlas-button atlas-button--active" : "atlas-button"}
                  onClick={() => toggleFeature(feature)}
                >
                  {checked ? "Showing" : "Hidden"}
                </button>
                <button
                  type="button"
                  className={active ? "atlas-button atlas-button--active" : "atlas-button"}
                  onClick={() => setActiveFeature(feature)}
                  disabled={!checked || active}
                >
                  {active ? "Default view" : "Set as default"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="atlas-note">{status}</p>

      <button
        type="button"
        className="atlas-button atlas-button--primary"
        onClick={savePreferences}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save"}
      </button>
    </section>
  );
}
