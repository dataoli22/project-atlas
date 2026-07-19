import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageScaffold } from "@/components/page-scaffold";
import { SettingsTabs } from "@/components/settings-tabs";
import { getIntegrationSourcesData, getOnboardingPageData, getSearchSettingsData } from "@/lib/settings-data";

export default async function SettingsSetupPage() {
  const [onboarding, integrations, search] = await Promise.all([
    getOnboardingPageData(),
    getIntegrationSourcesData(),
    getSearchSettingsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Settings"
      title="Setup"
      description="Profile, health apps, AI, and search - the same guided setup shown on first launch, always here to revisit and edit."
      tags={["Setup", "Local-first"]}
    >
      <SettingsTabs />
      <OnboardingWizard
        initialProfile={onboarding.profile.data}
        initialLocalization={onboarding.localization.data}
        markets={onboarding.markets.data}
        initialAiSettings={onboarding.ai.data}
        initialIntegrations={integrations.data}
        initialSearchSettings={search.data}
      />
    </PageScaffold>
  );
}
