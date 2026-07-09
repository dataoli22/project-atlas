import Link from "next/link";

import { AppLockSettingsForm } from "@/components/app-lock-settings-form";
import { FeaturePreferencesForm } from "@/components/feature-preferences-form";
import { PageScaffold } from "@/components/page-scaffold";
import { DataSourceBadge, SettingsDataList } from "@/components/settings-data-list";
import { getAppLockSettingsData } from "@/lib/app-lock-data";
import { getSettingsPageData } from "@/lib/settings-data";

function formatFeatureLabel(featureKey: string) {
  return featureKey === "endurance" ? "Endurance" : "Nutrition";
}

export default async function SettingsPage() {
  const [settings, appLock] = await Promise.all([getSettingsPageData(), getAppLockSettingsData()]);
  const activeFeature =
    settings.featureRegistry.data.features.find((feature) => feature.key === settings.featureRegistry.data.activeFeature) ??
    settings.featureRegistry.data.features[0];

  return (
    <PageScaffold
      eyebrow="Shared settings"
      title="Global Atlas settings"
      description="This shared route now reads shared feature state, profile defaults, localization, and market options from the scaffolded API layer, while keeping stub fallbacks isolated in one frontend module."
      tags={["Shared settings", "Locale", "Feature state"]}
      metrics={[
        { label: "Active workspace", value: activeFeature?.label ?? "Atlas shell" },
        { label: "Enabled features", value: settings.appPreferences.data.enabledFeatureFlags.length.toString() },
        { label: "Shared locale", value: settings.localization.data.locale }
      ]}
    >
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Shared preferences preview</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Features" source={settings.featureRegistry.source} />
            <DataSourceBadge label="Preferences" source={settings.appPreferences.source} />
            <DataSourceBadge label="Localization" source={settings.localization.source} />
          </div>
          <SettingsDataList
            items={[
              {
                label: "Active workspace",
                value:
                  settings.featureRegistry.data.features.find(
                    (feature) => feature.key === settings.appPreferences.data.activeFeature
                  )?.label ?? "Unavailable"
              },
              {
                label: "Enabled modules",
                value: settings.appPreferences.data.enabledFeatureFlags.map(formatFeatureLabel).join(" and ")
              },
              {
                label: "Shell density",
                value: settings.appPreferences.data.preferredPlatformDensity
              },
              {
                label: "Shared locale",
                value: settings.appPreferences.data.sharedLocale
              }
            ]}
          />
          <p className="atlas-note">
            The page reads current shell state from the shared loaders now, and the shell settings below can save
            active-feature and enabled-feature preferences through the shared preferences endpoint.
          </p>
        </section>

        <FeaturePreferencesForm
          initialFeatures={settings.featureRegistry.data.features}
          initialPreferences={settings.appPreferences.data}
          initialSource={settings.appPreferences.source}
        />

        <AppLockSettingsForm initialSettings={appLock.data} initialSource={appLock.source} />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Profile defaults</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Profile" source={settings.profile.source} />
          </div>
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
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Localization state</div>
          <SettingsDataList
            items={[
              { label: "Market", value: settings.localization.data.market },
              { label: "Currency", value: settings.localization.data.currency },
              { label: "Language", value: settings.localization.data.language },
              {
                label: "Supported languages",
                value: settings.localization.data.supportedLanguages.join(", ")
              },
              {
                label: "Overrides",
                value: [
                  settings.localization.data.currencyOverride ? "Currency override" : null,
                  settings.localization.data.languageOverride ? "Language override" : null
                ]
                  .filter(Boolean)
                  .join(", ") || "Defaults only"
              }
            ]}
          />
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Shared preferences</div>
          <div className="atlas-list">
            <Link href="/settings/integrations" className="atlas-nav-link atlas-nav-link--active">
              Endurance integrations
            </Link>
            <Link href="/settings/tracking" className="atlas-nav-link atlas-nav-link--active">
              Endurance tracking fields
            </Link>
            <Link href="/onboarding" className="atlas-nav-link atlas-nav-link--active">
              Nutrition onboarding and market defaults
            </Link>
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Market registry</div>
          <div className="atlas-meta">
            <DataSourceBadge label="Markets" source={settings.markets.source} />
          </div>
          <div className="atlas-stack">
            {settings.markets.data.map((market) => (
              <div key={market.code} className="atlas-list-card">
                <div className="atlas-list-card__title">
                  {market.name} ({market.code})
                </div>
                <div className="atlas-list-card__meta">
                  {market.defaultCurrency} | {market.supportedLanguages.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel">
          <div className="atlas-panel__eyebrow">Shell behavior</div>
          <p className="atlas-note">
            Desktop keeps persistent navigation while mobile compresses the shell into bottom tabs. Because the shared
            settings data lives behind isolated loader functions, the real API can replace the stubs without forcing
            these pages to be rewritten. Enabled features now also control which modules appear in shell navigation.
          </p>
        </section>
      </div>
    </PageScaffold>
  );
}
