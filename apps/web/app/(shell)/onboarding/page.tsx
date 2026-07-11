import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageScaffold } from "@/components/page-scaffold";
import { getOnboardingPageData } from "@/lib/settings-data";

export default async function OnboardingPage() {
  const onboarding = await getOnboardingPageData();

  return (
    <PageScaffold
      eyebrow="Get started"
      title="Set up Atlas"
      description="A short, skippable setup so your nutrition plan generates real data from day one. Health provider connections are entirely optional."
      tags={["Onboarding", "Local-first", "Skippable providers"]}
    >
      <OnboardingWizard
        initialProfile={onboarding.profile.data}
        initialLocalization={onboarding.localization.data}
        markets={onboarding.markets.data}
      />
    </PageScaffold>
  );
}
