"use client";

import { BrainCircuit, CheckCircle2, CircleCheck, PartyPopper, Search, Smartphone, UserCircle2 } from "lucide-react";
import { useState, useTransition } from "react";

import { ConnectorPanel } from "@/components/connector-panel";
import { HintTooltip } from "@/components/hint-tooltip";
import { NutritionOnboardingForm } from "@/components/nutrition-onboarding-form";
import { PairingSettingsForm } from "@/components/pairing-settings-form";
import { StravaAppSettingsForm } from "@/components/strava-app-settings-form";
import { completeOnboarding, saveAISettings, saveSearchSettings, testAIRuntimeHealth } from "@/lib/settings-data";
import type { ApiDataSource } from "@/lib/api";
import type { PairedDeviceData } from "@/lib/pairing-data";
import type {
  AISettingsData,
  IntegrationSourceData,
  LocalizationSettingsData,
  MarketOptionData,
  ProfileSettingsData,
  SearchSettingsData,
  StravaAppSettingsData
} from "@/lib/settings-data";

const GROQ_KEYS_URL = "https://console.groq.com/keys";
const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";
const OLLAMA_CLOUD_KEYS_URL = "https://ollama.com/settings/keys";
const OLLAMA_CLOUD_BASE_URL = "https://ollama.com";
const OLLAMA_LOCAL_BASE_URL = "http://localhost:11434";
const BRAVE_KEYS_URL = "https://api.search.brave.com/app/keys";

type WizardStep = "profile" | "pair" | "strava" | "samsung_health" | "health_connect" | "ai" | "brave" | "finish";

const STEP_ORDER: WizardStep[] = [
  "profile",
  "pair",
  "strava",
  "samsung_health",
  "health_connect",
  "ai",
  "brave",
  "finish"
];

const STEP_LABEL: Record<WizardStep, string> = {
  profile: "Your details",
  pair: "Pair your device",
  strava: "Strava",
  samsung_health: "Samsung Health",
  health_connect: "Health Connect",
  ai: "AI setup",
  brave: "Web search",
  finish: "Finish"
};

// At least one real AI path must be confirmed before continuing - either on-device Ollama
// verified reachable (needs no key at all, Atlas's zero-config default) or a cloud key entered
// (Groq, or Ollama pointed at a hosted endpoint). Chat falls back to a canned deterministic
// answer with neither, which is a poor first impression for a feature this central.
function hasWorkingAiPath(ai: AISettingsData, ollamaVerifiedReachable: boolean): boolean {
  return ollamaVerifiedReachable || ai.groqApiKeySet || ai.ollamaApiKeySet;
}

type OnboardingWizardProps = {
  initialProfile: ProfileSettingsData;
  initialLocalization: LocalizationSettingsData;
  markets: MarketOptionData[];
  initialAiSettings: AISettingsData;
  initialIntegrations: IntegrationSourceData[];
  initialIntegrationsSource: ApiDataSource;
  initialSearchSettings: SearchSettingsData;
  initialPairedDevices: PairedDeviceData[];
  pairedDevicesLoadOk: boolean;
  initialStravaAppSettings: StravaAppSettingsData;
  initialStravaAppSettingsSource: ApiDataSource;
};

export function OnboardingWizard({
  initialProfile,
  initialLocalization,
  markets,
  initialAiSettings,
  initialIntegrations,
  initialIntegrationsSource,
  initialSearchSettings,
  initialPairedDevices,
  pairedDevicesLoadOk,
  initialStravaAppSettings,
  initialStravaAppSettingsSource
}: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("profile");
  const [profileSaved, setProfileSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [integrations] = useState(initialIntegrations);

  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [ollamaVerified, setOllamaVerified] = useState(false);
  const [ollamaCheckMessage, setOllamaCheckMessage] = useState<string | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [groqError, setGroqError] = useState<string | null>(null);
  const [isSavingGroq, setIsSavingGroq] = useState(false);
  const [ollamaCloudKeyInput, setOllamaCloudKeyInput] = useState("");
  const [ollamaCloudError, setOllamaCloudError] = useState<string | null>(null);
  const [isSavingOllamaCloud, setIsSavingOllamaCloud] = useState(false);

  const [searchSettings, setSearchSettings] = useState(initialSearchSettings);
  const [braveKeyInput, setBraveKeyInput] = useState("");
  const [braveError, setBraveError] = useState<string | null>(null);
  const [isSavingBrave, setIsSavingBrave] = useState(false);

  const aiConfigured = hasWorkingAiPath(aiSettings, ollamaVerified);
  const braveConfigured = searchSettings.braveApiKeySet;

  function checkOllama() {
    setIsCheckingOllama(true);
    setOllamaCheckMessage(null);
    testAIRuntimeHealth({
      ollamaBaseUrl: OLLAMA_LOCAL_BASE_URL,
      ollamaModel: aiSettings.ollamaModel,
      ollamaEmbedModel: aiSettings.ollamaEmbedModel
    }).then((result) => {
      setOllamaVerified(result.data.ok);
      setOllamaCheckMessage(result.data.message);
      setIsCheckingOllama(false);
    });
  }

  function saveGroqKey() {
    if (!groqKeyInput.trim()) {
      setGroqError("Enter a Groq API key first.");
      return;
    }
    setIsSavingGroq(true);
    setGroqError(null);
    saveAISettings({
      ...aiSettings,
      defaultProvider: "groq",
      allowGroq: true,
      groqApiKey: groqKeyInput.trim()
    }).then((result) => {
      setIsSavingGroq(false);
      if (result.source !== "api") {
        setGroqError("Atlas could not reach the local backend to save this key. Try again.");
        return;
      }
      setAiSettings(result.data);
      setGroqKeyInput("");
    });
  }

  function saveOllamaCloudKey() {
    if (!ollamaCloudKeyInput.trim()) {
      setOllamaCloudError("Enter an Ollama Cloud API key first.");
      return;
    }
    setIsSavingOllamaCloud(true);
    setOllamaCloudError(null);
    saveAISettings({
      ...aiSettings,
      defaultProvider: "ollama",
      ollamaBaseUrl: OLLAMA_CLOUD_BASE_URL,
      ollamaApiKey: ollamaCloudKeyInput.trim()
    }).then((result) => {
      setIsSavingOllamaCloud(false);
      if (result.source !== "api") {
        setOllamaCloudError("Atlas could not reach the local backend to save this key. Try again.");
        return;
      }
      setAiSettings(result.data);
      setOllamaCloudKeyInput("");
    });
  }

  function saveBraveKey() {
    if (!braveKeyInput.trim()) {
      setBraveError("Enter a Brave Search API key first.");
      return;
    }
    setIsSavingBrave(true);
    setBraveError(null);
    saveSearchSettings({ braveApiKey: braveKeyInput.trim() }).then((result) => {
      setIsSavingBrave(false);
      if (result.source !== "api") {
        setBraveError("Atlas could not reach the local backend to save this key. Try again.");
        return;
      }
      setSearchSettings(result.data);
      setBraveKeyInput("");
    });
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  function goTo(nextStep: WizardStep) {
    setStep(nextStep);
  }

  function finish() {
    startTransition(async () => {
      await completeOnboarding();
      // A full hard navigation, not router.push: the (shell) layout's OnboardingGate reads
      // hasCompletedOnboarding from a server-fetched prop, and layouts persist across
      // client-side navigation in the App Router - router.push (even preceded by
      // router.refresh(), which races the navigation) can land back here with the stale
      // "false" value still in the already-rendered layout. window.location.assign forces a
      // real page load, so the layout's server fetch is guaranteed to run fresh against the
      // now-updated backend state.
      window.location.assign("/nutrition");
    });
  }

  return (
    <div className="atlas-panel atlas-stack" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div className="atlas-panel__eyebrow">Getting started</div>
      <p className="atlas-note">
        Jump straight to any module below, or use Back/Continue to work through them in order.
      </p>
      <div className="atlas-feature-switcher" role="navigation" aria-label="Jump to a setup module">
        {STEP_ORDER.map((candidate, index) => (
          <button
            key={candidate}
            type="button"
            onClick={() => goTo(candidate)}
            className={candidate === step ? "atlas-chip atlas-chip--active" : "atlas-chip"}
          >
            {index < stepIndex ? (
              <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <span aria-hidden="true">{index + 1}.</span>
            )}
            <span>{STEP_LABEL[candidate]}</span>
          </button>
        ))}
      </div>

      {step === "profile" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <UserCircle2 size={26} strokeWidth={1.75} aria-hidden="true" />
            Tell us about you
          </h2>
          <p className="atlas-note">
            Your region and a few body basics are enough to generate a nutrition plan right away;
            no connected app is required. Everything entered here stays on this device.
          </p>
          <NutritionOnboardingForm
            initialProfile={initialProfile}
            initialLocalization={initialLocalization}
            markets={markets}
            onSaved={() => setProfileSaved(true)}
          />
          <div className="atlas-control-card__actions">
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={() => goTo("pair")}
              disabled={!profileSaved}
            >
              {profileSaved ? "Continue" : "Save above to continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "pair" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <Smartphone size={22} strokeWidth={1.75} aria-hidden="true" />
            Pair your device
          </h2>
          <p className="atlas-note">
            Pairing a phone is how Health Connect and Samsung Health data reaches Atlas - both live
            on the phone, not this device. This step is optional and can be revisited anytime.
          </p>
          <PairingSettingsForm initialDevices={initialPairedDevices} devicesLoadOk={pairedDevicesLoadOk} />
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("profile")}>
              Back
            </button>
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("strava")}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "strava" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            Connect Strava
          </h2>
          <p className="atlas-note">
            Optional. Brings in real activities and training load instead of sample data.
          </p>
          <StravaAppSettingsForm
            initialSettings={initialStravaAppSettings}
            initialSource={initialStravaAppSettingsSource}
          />
          <ConnectorPanel
            initialIntegration={integrations.find((item) => item.key === "strava")!}
            initialSource={initialIntegrationsSource}
          />
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("pair")}>
              Back
            </button>
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("samsung_health")}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "samsung_health" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            Connect Samsung Health
          </h2>
          <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
            Optional and in development: the device-side code required to read Samsung Health has
            not yet been built or tested on hardware, so this can be skipped for a working setup.
          </p>
          <ConnectorPanel
            initialIntegration={integrations.find((item) => item.key === "samsung_health")!}
            initialSource={initialIntegrationsSource}
          />
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("strava")}>
              Back
            </button>
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("health_connect")}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "health_connect" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            Connect Health Connect
          </h2>
          <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
            Optional and in development: the device-side code required to read Health Connect
            (Android&apos;s health data hub, including Google Fit-sourced data) has not yet been built
            or tested on hardware, so this can be skipped for a working setup.
          </p>
          <ConnectorPanel
            initialIntegration={integrations.find((item) => item.key === "health_connect")!}
            initialSource={initialIntegrationsSource}
          />
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("samsung_health")}>
              Back
            </button>
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("ai")}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "ai" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <BrainCircuit size={22} strokeWidth={1.75} aria-hidden="true" />
            Set up AI
          </h2>
          <p className="atlas-note">
            Atlas requires one of these to be configured before it can generate answers. Choose
            whichever fits; Continue unlocks once a provider is confirmed. Others can be added,
            or this choice changed, at any time from Settings.
          </p>
          <p className="atlas-note">
            Any key entered here is sent directly from this device to that provider and nowhere
            else, never through an Atlas server. Atlas does not see it, store it remotely, or have
            any way to access it, and neither does anyone else.
          </p>

          {aiSettings.localOnlyMode ? (
            <p className="atlas-note">
              Local-only mode is enabled, so cloud options are disabled; on-device Ollama is the
              only available provider. Turn off local-only mode in Settings first to use a cloud
              option.
            </p>
          ) : (
            <>
              <div className="atlas-list-card">
                <div
                  className="atlas-list-card__title"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  Option A: Groq (cloud, free tier)
                  <HintTooltip label="How to get a Groq key">
                    Create a free account, then generate an API key from the Groq console.{" "}
                    <a href={GROQ_KEYS_URL} target="_blank" rel="noreferrer">
                      Get a key
                    </a>
                  </HintTooltip>
                </div>
                <div className="atlas-list-card__meta">Faster than most local hardware, and requires no local installation.</div>
                <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                  <input
                    type="password"
                    value={groqKeyInput}
                    onChange={(event) => setGroqKeyInput(event.target.value)}
                    placeholder={aiSettings.groqApiKeySet ? "Key already saved. Enter a new value to replace it." : "Groq API key"}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--atlas-border)",
                      background: "var(--atlas-surface-strong)",
                      color: "var(--atlas-ink)"
                    }}
                  />
                </div>
                <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary"
                    onClick={saveGroqKey}
                    disabled={isSavingGroq}
                  >
                    {isSavingGroq ? "Saving..." : "Save Groq key"}
                  </button>
                  {aiSettings.groqApiKeySet ? (
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--atlas-accent)" }}
                    >
                      <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                      Key saved
                    </span>
                  ) : null}
                </div>
                {groqError ? (
                  <p className="atlas-note" style={{ color: "var(--atlas-danger)" }}>
                    {groqError}
                  </p>
                ) : null}
              </div>

              <div className="atlas-list-card">
                <div
                  className="atlas-list-card__title"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  Option B: Ollama Cloud (hosted, free tier)
                  <HintTooltip label="How to get an Ollama Cloud key">
                    Sign in at ollama.com, then generate an API key for Ollama&apos;s hosted models. No
                    local installation is required.{" "}
                    <a href={OLLAMA_CLOUD_KEYS_URL} target="_blank" rel="noreferrer">
                      Get a key
                    </a>
                  </HintTooltip>
                </div>
                <div className="atlas-list-card__meta">
                  Runs on Ollama&apos;s servers instead of this device. No local installation is required.
                </div>
                <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                  <input
                    type="password"
                    value={ollamaCloudKeyInput}
                    onChange={(event) => setOllamaCloudKeyInput(event.target.value)}
                    placeholder={
                      aiSettings.ollamaApiKeySet ? "Key already saved. Enter a new value to replace it." : "Ollama Cloud API key"
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--atlas-border)",
                      background: "var(--atlas-surface-strong)",
                      color: "var(--atlas-ink)"
                    }}
                  />
                </div>
                <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    className="atlas-button atlas-button--secondary"
                    onClick={saveOllamaCloudKey}
                    disabled={isSavingOllamaCloud}
                  >
                    {isSavingOllamaCloud ? "Saving..." : "Save Ollama Cloud key"}
                  </button>
                  {aiSettings.ollamaApiKeySet && aiSettings.ollamaBaseUrl === OLLAMA_CLOUD_BASE_URL ? (
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--atlas-accent)" }}
                    >
                      <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                      Key saved
                    </span>
                  ) : null}
                </div>
                {ollamaCloudError ? (
                  <p className="atlas-note" style={{ color: "var(--atlas-danger)" }}>
                    {ollamaCloudError}
                  </p>
                ) : null}
              </div>
            </>
          )}

          <div className="atlas-list-card">
            <div
              className="atlas-list-card__title"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              Option C: On-device Ollama (recommended, free, private)
              <HintTooltip label="How to set up Ollama">
                Download and install Ollama, then leave it running in the background - Atlas talks to it
                automatically, no key needed.{" "}
                <a href={OLLAMA_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                  Download Ollama
                </a>
              </HintTooltip>
            </div>
            <div className="atlas-list-card__meta">
              No key required. This confirms Atlas can reach Ollama running on this machine.
            </div>
            <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
              <button
                type="button"
                className="atlas-button atlas-button--secondary"
                onClick={checkOllama}
                disabled={isCheckingOllama}
              >
                {isCheckingOllama ? "Checking..." : "Check Ollama connection"}
              </button>
              {ollamaVerified ? (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--atlas-accent)" }}
                >
                  <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                  Reachable
                </span>
              ) : null}
            </div>
            {ollamaCheckMessage ? <p className="atlas-note">{ollamaCheckMessage}</p> : null}
          </div>

          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("health_connect")}>
              Back
            </button>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={() => goTo("brave")}
              disabled={!aiConfigured}
            >
              {aiConfigured ? "Continue" : "Set up at least one option to continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "brave" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <Search size={22} strokeWidth={1.75} aria-hidden="true" />
            Set up web search
          </h2>
          <p className="atlas-note">
            Not every food is yet in Atlas&apos;s product database. A Brave Search key lets Atlas
            fall back to the web so a lookup never comes up empty. This step is required to
            finish setup.
          </p>
          <p className="atlas-note">
            As with the AI keys, this key is sent directly from this device to Brave, never
            through an Atlas server, and Atlas has no access to it.
          </p>

          <div className="atlas-list-card">
            <div
              className="atlas-list-card__title"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              Brave Search API key
              <HintTooltip label="How to get a Brave Search key">
                Create a free Brave Search API account, then copy your API key from the dashboard.{" "}
                <a href={BRAVE_KEYS_URL} target="_blank" rel="noreferrer">
                  Get a key
                </a>
              </HintTooltip>
            </div>
            <div className="atlas-list-card__meta">Free tier is enough for everyday nutrition lookups.</div>
            <div className="atlas-form-field" style={{ marginTop: "10px" }}>
              <input
                type="password"
                value={braveKeyInput}
                onChange={(event) => setBraveKeyInput(event.target.value)}
                placeholder={braveConfigured ? "Key already saved. Enter a new value to replace it." : "Brave Search API key"}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--atlas-border)",
                  background: "var(--atlas-surface-strong)",
                  color: "var(--atlas-ink)"
                }}
              />
            </div>
            <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
              <button
                type="button"
                className="atlas-button atlas-button--secondary"
                onClick={saveBraveKey}
                disabled={isSavingBrave}
              >
                {isSavingBrave ? "Saving..." : "Save Brave key"}
              </button>
              {braveConfigured ? (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--atlas-accent)" }}
                >
                  <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                  Key saved
                </span>
              ) : null}
            </div>
            {braveError ? (
              <p className="atlas-note" style={{ color: "var(--atlas-danger)" }}>
                {braveError}
              </p>
            ) : null}
          </div>

          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("ai")}>
              Back
            </button>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={() => goTo("finish")}
              disabled={!braveConfigured}
            >
              {braveConfigured ? "Continue" : "Save your key above to continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "finish" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <PartyPopper size={22} strokeWidth={1.75} aria-hidden="true" />
            Ready to go
          </h2>
          <p className="atlas-note">
            Your nutrition plan is generating from the profile and market just configured. Any of
            this, including connecting a health app, can be revisited from Settings at any time.
          </p>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("brave")}>
              Back
            </button>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={finish}
              disabled={isPending}
            >
              {isPending ? "Finishing..." : "Finish setup"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
