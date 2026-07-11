import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageScaffold } from "@/components/page-scaffold";
import { SettingsTabs } from "@/components/settings-tabs";
import { getOnboardingPageData } from "@/lib/settings-data";

export default async function SettingsSetupPage() {
  const onboarding = await getOnboardingPageData();

  return (
    <PageScaffold
      eyebrow="Settings"
      title="Setup"
      description="Profile, market, and health provider connections - the same short wizard shown on first launch, always here to revisit and edit. Provider connections stay entirely optional."
      tags={["Setup", "Local-first", "Skippable providers"]}
    >
      <SettingsTabs />
      <OnboardingWizard
        initialProfile={onboarding.profile.data}
        initialLocalization={onboarding.localization.data}
        markets={onboarding.markets.data}
        initialAiSettings={onboarding.ai.data}
      />
    </PageScaffold>
  );
}
