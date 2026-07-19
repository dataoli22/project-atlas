import { AIRuntimeSettingsForm } from "@/components/ai-runtime-settings-form";
import { IntegrationConnectForm } from "@/components/integration-connect-form";
import { PageScaffold } from "@/components/page-scaffold";
import { PairingSettingsForm } from "@/components/pairing-settings-form";
import { SearchSettingsForm } from "@/components/search-settings-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { StravaAppSettingsForm } from "@/components/strava-app-settings-form";
import { DataSourceBadge } from "@/components/settings-data-list";
import { getPairedDevices } from "@/lib/pairing-data";
import {
  getAISettingsData,
  getIntegrationSourcesData,
  getSearchSettingsData,
  getStravaAppSettingsData
} from "@/lib/settings-data";

export default async function IntegrationsSettingsPage() {
  const [ai, integrations, pairing, search, strava] = await Promise.all([
    getAISettingsData(),
    getIntegrationSourcesData(),
    getPairedDevices(),
    getSearchSettingsData(),
    getStravaAppSettingsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Settings"
      title="Integrations"
      description="Connect health apps, set up your AI assistant, and turn on web search - everything Atlas talks to outside itself."
      tags={["Health apps", "AI assistant", "Web search"]}
      metrics={[
        { label: "Connected apps", value: integrations.data.filter((integration) => integration.connected).length.toString() },
        { label: "AI provider", value: ai.data.defaultProvider === "ollama" ? "Ollama (on-device)" : "Groq (cloud)" },
        { label: "Fully on-device", value: ai.data.localOnlyMode ? "Yes" : "No" }
      ]}
    >
      <SettingsTabs />
      <div className="atlas-grid atlas-grid--hero">
        <IntegrationConnectForm
          initialIntegrations={integrations.data}
          initialSource={integrations.source}
        />

        <StravaAppSettingsForm initialSettings={strava.data} initialSource={strava.source} />

        <PairingSettingsForm
          initialDevices={pairing.ok ? pairing.devices : []}
          devicesLoadOk={pairing.ok}
        />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">How your AI assistant runs</div>
          <div className="atlas-meta">
            <DataSourceBadge label="AI settings" source={ai.source} />
          </div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Stays on this device only</dt>
              <dd>{ai.data.localOnlyMode ? "Yes" : "No - an optional cloud provider is allowed"}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Cloud fallback (Groq)</dt>
              <dd>{ai.data.allowGroq ? "Allowed" : "Off"}</dd>
            </div>
          </dl>
          <p className="atlas-note">
            Any key you enter here stays on this device and goes straight to that provider - never
            through an Atlas server. We have no access to it, and neither does anyone else. Use the
            connection check below to confirm Atlas can reach Ollama.
          </p>
        </section>

        <AIRuntimeSettingsForm initialSettings={ai.data} initialSource={ai.source} />

        <SearchSettingsForm initialSettings={search.data} initialSource={search.source} />
      </div>
    </PageScaffold>
  );
}
