import { NutritionOnboardingForm } from "@/components/nutrition-onboarding-form";
import { PageScaffold } from "@/components/page-scaffold";
import { DataSourceBadge, SettingsDataList } from "@/components/settings-data-list";
import { getOnboardingPageData } from "@/lib/settings-data";

export default async function OnboardingPage() {
  const onboarding = await getOnboardingPageData();
  const profileReadyCount = [
    onboarding.profile.data.primaryGoal,
    onboarding.profile.data.profileType,
    onboarding.profile.data.activityLevel,
    onboarding.profile.data.hydration,
    onboarding.profile.data.bodyWeight
  ].filter(Boolean).length;

  return (
    <PageScaffold
      eyebrow="Nutrition module"
      title="Supported-market onboarding"
      description="This onboarding route now reads shared profile, localization, market, and feature-registry data through modular loaders so the staged nutrition flow can plug into real APIs later without replacing the page structure."
      tags={["Nutrition", "Market gating", "Localization defaults"]}
      metrics={[
        { label: "Markets", value: onboarding.markets.data.length.toString() },
        { label: "Locale", value: onboarding.localization.data.locale },
        { label: "Starter fields", value: `${profileReadyCount}/5` }
      ]}
    >
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Profile and constraints</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Profile" source={onboarding.profile.source} />
          </div>
          <SettingsDataList
            items={[
              { label: "Primary goal", value: onboarding.profile.data.primaryGoal ?? "Collect during onboarding" },
              { label: "Profile type", value: onboarding.profile.data.profileType ?? "Collect during onboarding" },
              {
                label: "Activity level",
                value: onboarding.profile.data.activityLevel ?? "Collect during onboarding"
              },
              {
                label: "Hydration baseline",
                value: onboarding.profile.data.hydration
                  ? `${onboarding.profile.data.hydration.amount} ${onboarding.profile.data.hydration.unit}`
                  : "Collect during onboarding"
              },
              {
                label: "Body weight",
                value: onboarding.profile.data.bodyWeight
                  ? `${onboarding.profile.data.bodyWeight.value} ${onboarding.profile.data.bodyWeight.unit}`
                  : "Collect during onboarding"
              }
            ]}
          />
          <p className="atlas-note">
            This is ready for a staged form flow: the page already renders from shared profile loaders instead of fixed
            placeholder text.
          </p>
        </section>

        <NutritionOnboardingForm
          initialProfile={onboarding.profile.data}
          initialLocalization={onboarding.localization.data}
          markets={onboarding.markets.data}
        />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Locale preview</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Localization" source={onboarding.localization.source} />
            <DataSourceBadge label="Markets" source={onboarding.markets.source} />
          </div>
          <SettingsDataList
            items={[
              {
                label: "Selected market",
                value: `${onboarding.selectedMarket.name} (${onboarding.selectedMarket.code})`
              },
              { label: "Currency", value: onboarding.localization.data.currency },
              { label: "Language", value: onboarding.localization.data.language },
              { label: "Locale", value: onboarding.localization.data.locale },
              {
                label: "Supported languages",
                value: onboarding.selectedMarket.supportedLanguages.join(", ")
              }
            ]}
          />
          <p className="atlas-note">
            Market-aware currency and language defaults now come from the shared settings endpoints, with local stub
            data only used when those endpoints are unreachable.
          </p>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Feature access</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Features" source={onboarding.featureRegistry.source} />
          </div>
          <div className="atlas-stack">
            {onboarding.featureRegistry.data.features.map((feature) => (
              <div key={feature.key} className="atlas-list-card">
                <div className="atlas-list-card__title">{feature.label}</div>
                <div className="atlas-list-card__meta">{feature.enabled ? "Enabled" : "Disabled"} | {feature.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Supported markets</div>
          <div className="atlas-stack">
            {onboarding.markets.data.map((market) => (
              <div key={market.code} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {market.name} ({market.code})
                </div>
                <div className="atlas-list-card__meta">
                  {market.defaultCurrency} | default {market.defaultLanguage} | {market.supportedLanguages.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageScaffold>
  );
}
