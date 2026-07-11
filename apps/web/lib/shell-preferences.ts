"use client";

import { useEffect, useState } from "react";

import type { AppPreference, AtlasFeature } from "@atlas/shared";

import { featureOptions, mobileNavItems, navGroups, type AtlasNavItem } from "@/lib/navigation";
import { getAppPreferencesData, getFeatureRegistryData } from "@/lib/settings-data";

type ShellFeatureState = {
  activeFeature: AtlasFeature;
  enabledFeatures: AtlasFeature[];
};

const defaultState: ShellFeatureState = {
  activeFeature: "nutrition",
  enabledFeatures: ["nutrition", "endurance"]
};

function filterNavItems(items: AtlasNavItem[], enabledFeatures: AtlasFeature[]) {
  return items.filter((item) => item.feature === "shared" || enabledFeatures.includes(item.feature));
}

export function useShellFeatureState() {
  const [state, setState] = useState<ShellFeatureState>(defaultState);

  useEffect(() => {
    let cancelled = false;

    function applyPreferences(preferences: AppPreference, registryEnabled: AtlasFeature[]) {
      const enabledFeatures = preferences.enabledFeatureFlags.filter((feature) =>
        registryEnabled.includes(feature)
      );

      return {
        activeFeature:
          enabledFeatures.includes(preferences.activeFeature)
            ? preferences.activeFeature
            : enabledFeatures[0] ?? "nutrition",
        enabledFeatures: enabledFeatures.length > 0 ? enabledFeatures : registryEnabled
      };
    }

    async function load() {
      const [registryResult, preferencesResult] = await Promise.all([
        getFeatureRegistryData(),
        getAppPreferencesData()
      ]);

      if (cancelled) {
        return;
      }

      const registryEnabled = registryResult.data.features
        .filter((feature) => feature.enabled)
        .map((feature) => feature.key);
      setState(applyPreferences(preferencesResult.data, registryEnabled));
    }

    function handlePreferencesUpdated(event: Event) {
      const customEvent = event as CustomEvent<AppPreference>;
      const registryEnabled = [...defaultState.enabledFeatures];
      setState(applyPreferences(customEvent.detail, registryEnabled));
    }

    void load();
    window.addEventListener("atlas:preferences-updated", handlePreferencesUpdated as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener("atlas:preferences-updated", handlePreferencesUpdated as EventListener);
    };
  }, []);

  return {
    activeFeature: state.activeFeature,
    enabledFeatures: state.enabledFeatures,
    visibleFeatureOptions: featureOptions.filter((feature) => state.enabledFeatures.includes(feature.id)),
    visibleNavGroups: navGroups
      .map((group) => ({
        ...group,
        items: filterNavItems(group.items, state.enabledFeatures)
      }))
      .filter((group) => group.items.length > 0),
    visibleMobileNavItems: filterNavItems(mobileNavItems, state.enabledFeatures)
  };
}
