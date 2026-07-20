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
      description="Connect health apps, configure the AI assistant, and enable web search. These are the only external services Atlas communicates with."
      tags={["Health apps", "AI assistant", "Web search"]}
      metrics={[
        { label: "Connected apps", value: integrations.data.filter((integration) => integration.connected).length.toString() },
        { label: "AI provider", value: ai.data.defaultProvider === "ollama" ? "Ollama (on-device)" : "Groq (cloud)" },
        { label: "Fully on-device", value: ai.data.localOnlyMode ? "Yes" : "No" }
      ]}
    >
      <SettingsTabs />

      {/* Full width, not part of a hero grid column, so the three connector cards inside can lay
          out side by side instead of being squeezed into a half-width panel. */}
      <IntegrationConnectForm
        initialIntegrations={integrations.data}
        initialSource={integrations.source}
      />

      <div className="atlas-grid atlas-grid--hero">
        <StravaAppSettingsForm initialSettings={strava.data} initialSource={strava.source} />

        <PairingSettingsForm
          initialDevices={pairing.ok ? pairing.devices : []}
          devicesLoadOk={pairing.ok}
        />
      </div>

      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">How your AI assistant runs</div>
          <div className="atlas-meta">
            <DataSourceBadge label="AI settings" source={ai.source} />
          </div>
          <dl className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Stays on this device only</dt>
              <dd>{ai.data.localOnlyMode ? "Yes" : "No (an optional cloud provider is allowed)"}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Cloud fallback (Groq)</dt>
              <dd>{ai.data.allowGroq ? "Allowed" : "Off"}</dd>
            </div>
          </dl>
          <p className="atlas-note">
            Any key entered here stays on this device and is sent directly to that provider,
            never through an Atlas server. Atlas has no access to it, and neither does anyone
            else. Use the connection check below to confirm Atlas can reach Ollama.
          </p>
        </section>

        <SearchSettingsForm initialSettings={search.data} initialSource={search.source} />
      </div>

      <AIRuntimeSettingsForm initialSettings={ai.data} initialSource={ai.source} />
    </PageScaffold>
  );
}
