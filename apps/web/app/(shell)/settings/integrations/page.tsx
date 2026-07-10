import { AIRuntimeSettingsForm } from "@/components/ai-runtime-settings-form";
import { IntegrationConnectForm } from "@/components/integration-connect-form";
import { PageScaffold } from "@/components/page-scaffold";
import { PairingSettingsForm } from "@/components/pairing-settings-form";
import { SearchSettingsForm } from "@/components/search-settings-form";
import { DataSourceBadge } from "@/components/settings-data-list";
import { getPairedDevices } from "@/lib/pairing-data";
import { getAISettingsData, getIntegrationSourcesData, getSearchSettingsData } from "@/lib/settings-data";

export default async function IntegrationsSettingsPage() {
  const [ai, integrations, pairing, search] = await Promise.all([
    getAISettingsData(),
    getIntegrationSourcesData(),
    getPairedDevices(),
    getSearchSettingsData()
  ]);

  return (
    <PageScaffold
      eyebrow="Shared integrations"
      title="On-device AI and connector runtime"
      description="This route now manages Atlas as a self-contained local app: Ollama stays the default fully local provider, optional Groq remains device-configured only, and you can test local Ollama reachability here before saving runtime changes."
      tags={["Ollama", "Groq", "Local-first", "Device-only keys"]}
      metrics={[
        { label: "Default provider", value: ai.data.defaultProvider },
        { label: "Local-only mode", value: ai.data.localOnlyMode ? "Enabled" : "Disabled" },
        { label: "Prompt style", value: ai.data.systemPromptStyle }
      ]}
    >
      <div className="atlas-grid atlas-grid--hero">
        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Runtime posture</div>
          <div className="atlas-meta">
            <DataSourceBadge label="AI settings" source={ai.source} />
          </div>
          <div className="atlas-detail-list">
            <div className="atlas-detail-list__row">
              <dt>Distribution model</dt>
              <dd>{ai.data.selfHostedDistribution ? "Self-contained app package" : "Browser-first dev mode"}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Device-only runtime</dt>
              <dd>{ai.data.localOnlyMode ? "Yes" : "Optional remote provider allowed"}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Ollama base URL</dt>
              <dd>{ai.data.ollamaBaseUrl}</dd>
            </div>
            <div className="atlas-detail-list__row">
              <dt>Groq allowed</dt>
              <dd>{ai.data.allowGroq ? "Yes" : "No"}</dd>
            </div>
          </div>
          <p className="atlas-note">
            Keys are intended to stay on the local device runtime only. In the packaged desktop or phone build, the UI
            talks to a user-owned local process rather than a centralized Atlas cloud. Use the runtime check below to confirm that Atlas can reach Ollama on this device without exposing stored secrets.
          </p>
        </section>

        <AIRuntimeSettingsForm initialSettings={ai.data} initialSource={ai.source} />

        <IntegrationConnectForm
          initialIntegrations={integrations.data}
          initialSource={integrations.source}
        />

        <PairingSettingsForm
          initialDevices={pairing.ok ? pairing.devices : []}
          devicesLoadOk={pairing.ok}
        />

        <SearchSettingsForm initialSettings={search.data} initialSource={search.source} />

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Prompt guardrails</div>
          <div className="atlas-stack">
            {ai.data.promptProfiles.map((profile) => (
              <div key={profile.module} className="atlas-list-card">
                <div className="atlas-list-card__title">{profile.title}</div>
                <div className="atlas-list-card__meta">{profile.system_prompt}</div>
                <div className="atlas-list-card__meta">
                  {profile.token_strategy_note} | context {profile.max_context_tokens} | response {profile.response_token_budget}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-panel atlas-stack">
          <div className="atlas-panel__eyebrow">Connector summary</div>
          <div className="atlas-stack">
            {integrations.data.map((integration) => (
              <div key={integration.key} className="atlas-list-card">
                <div className="atlas-list-card__title">{integration.title}</div>
                <div className="atlas-list-card__meta">
                  {integration.connectMode} | {integration.connected ? "Connected" : "Not connected"}
                </div>
                <div className="atlas-list-card__meta">{integration.loginHint}</div>
                <div className="atlas-list-card__meta">
                  Runtime: {integration.runtimeSummary.synced_activity_count ?? integration.runtimeSummary.synced_session_count ?? 0} synced records
                </div>
                <div className="atlas-list-card__meta">Docs: {integration.docUrl}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageScaffold>
  );
}
