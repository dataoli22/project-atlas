import Link from "next/link";
import { ClipboardList, Link2 } from "lucide-react";

import { FeaturePreferencesForm } from "@/components/feature-preferences-form";
import { PageScaffold } from "@/components/page-scaffold";
import { SettingsTabs } from "@/components/settings-tabs";
import { SettingsDataList } from "@/components/settings-data-list";
import { UpdatesPanel } from "@/components/updates-panel";
import { getSettingsPageData } from "@/lib/settings-data";

export default async function SettingsPage() {
  const settings = await getSettingsPageData();
  const activeFeature =
    settings.featureRegistry.data.features.find((feature) => feature.key === settings.featureRegistry.data.activeFeature) ??
    settings.featureRegistry.data.features[0];

  return (
    <PageScaffold
      eyebrow="Settings"
      title="Overview"
      description="Choose which sections you use, check for updates, and see your saved profile. Your account, region, and AI setup live under Setup; connected apps live under Integrations."
      tags={["Settings"]}
      metrics={[
        { label: "Default view", value: activeFeature?.label ?? "Atlas" },
        { label: "Sections shown", value: settings.appPreferences.data.enabledFeatureFlags.length.toString() },
        { label: "Region", value: settings.localization.data.market }
      ]}
    >
      <SettingsTabs />

      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Jump to</div>
          <div className="atlas-meta">
            <Link href="/settings/setup" className="atlas-button">
              <ClipboardList size={15} strokeWidth={2} aria-hidden="true" />
              Setup - profile, region, AI
            </Link>
            <Link href="/settings/integrations" className="atlas-button">
              <Link2 size={15} strokeWidth={2} aria-hidden="true" />
              Integrations - connect apps
            </Link>
          </div>
        </section>

        <FeaturePreferencesForm
          initialFeatures={settings.featureRegistry.data.features}
          initialPreferences={settings.appPreferences.data}
          initialSource={settings.appPreferences.source}
        />

        <UpdatesPanel />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Your profile</div>
          <SettingsDataList
            items={[
              { label: "Primary goal", value: settings.profile.data.primaryGoal ?? "Not set" },
              { label: "Profile type", value: settings.profile.data.profileType ?? "Not set" },
              { label: "Activity level", value: settings.profile.data.activityLevel ?? "Not set" },
              {
                label: "Hydration target",
                value: settings.profile.data.hydration
                  ? `${settings.profile.data.hydration.amount} ${settings.profile.data.hydration.unit}`
                  : "Not set"
              },
              {
                label: "Body weight",
                value: settings.profile.data.bodyWeight
                  ? `${settings.profile.data.bodyWeight.value} ${settings.profile.data.bodyWeight.unit}`
                  : "Not set"
              }
            ]}
          />
          <p className="atlas-note">Edit these under Setup.</p>
        </section>
      </div>
    </PageScaffold>
  );
}
