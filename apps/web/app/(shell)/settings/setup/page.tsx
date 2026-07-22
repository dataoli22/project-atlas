import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageScaffold } from "@/components/page-scaffold";
import { SettingsTabs } from "@/components/settings-tabs";
import { getPairedDevices } from "@/lib/pairing-data";
import {
  getIntegrationSourcesData,
  getOnboardingPageData,
  getSearchSettingsData,
  getStravaAppSettingsData
} from "@/lib/settings-data";

export default async function SettingsSetupPage() {
  const [onboarding, integrations, search, pairing, strava] = await Promise.all([
    getOnboardingPageData(),
    getIntegrationSourcesData(),
    getSearchSettingsData(),
    getPairedDevices(),
    getStravaAppSettingsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Settings"
      title="Setup"
      description="Profile, device pairing, health apps, AI, and search. The same guided setup shown on first launch, available here to revisit and edit at any time."
      tags={["Setup", "Local-first"]}
    >
      <SettingsTabs />
      <OnboardingWizard
        initialProfile={onboarding.profile.data}
        initialLocalization={onboarding.localization.data}
        markets={onboarding.markets.data}
        initialAiSettings={onboarding.ai.data}
        initialIntegrations={integrations.data}
        initialIntegrationsSource={integrations.source}
        initialSearchSettings={search.data}
        initialPairedDevices={pairing.ok ? pairing.devices : []}
        pairedDevicesLoadOk={pairing.ok}
        initialStravaAppSettings={strava.data}
        initialStravaAppSettingsSource={strava.source}
        hasCompletedOnboarding={onboarding.appPreferences.data.hasCompletedOnboarding}
      />
    </PageScaffold>
  );
}
