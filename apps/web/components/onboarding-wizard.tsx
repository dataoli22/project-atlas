"use client";

import { BrainCircuit, CheckCircle2, CircleCheck, HeartPulse, PartyPopper, Search, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import { NutritionOnboardingForm } from "@/components/nutrition-onboarding-form";
import { CONNECTOR_INFO, isFullyConnected, pendingConnectionNote } from "@/lib/connector-info";
import {
  completeOnboarding,
  connectIntegrationSource,
  saveAISettings,
  saveSearchSettings,
  testAIRuntimeHealth
} from "@/lib/settings-data";
import type {
  AISettingsData,
  IntegrationSourceData,
  LocalizationSettingsData,
  MarketOptionData,
  ProfileSettingsData,
  SearchSettingsData
} from "@/lib/settings-data";

type IntegrationSourceKey = IntegrationSourceData["key"];

const GROQ_KEYS_URL = "https://console.groq.com/keys";
const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";
const OLLAMA_CLOUD_KEYS_URL = "https://ollama.com/settings/keys";
const OLLAMA_CLOUD_BASE_URL = "https://ollama.com";
const OLLAMA_LOCAL_BASE_URL = "http://localhost:11434";
const BRAVE_KEYS_URL = "https://api.search.brave.com/app/keys";

type WizardStep = "profile" | "connect" | "ai" | "brave" | "finish";

const STEP_ORDER: WizardStep[] = ["profile", "connect", "ai", "brave", "finish"];

const STEP_LABEL: Record<WizardStep, string> = {
  profile: "Your details",
  connect: "Health apps",
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
  initialSearchSettings: SearchSettingsData;
};

export function OnboardingWizard({
  initialProfile,
  initialLocalization,
  markets,
  initialAiSettings,
  initialIntegrations,
  initialSearchSettings
}: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("profile");
  const [profileSaved, setProfileSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [connectingKey, setConnectingKey] = useState<IntegrationSourceKey | null>(null);

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

  function connectSource(key: IntegrationSourceKey) {
    setConnectingKey(key);
    connectIntegrationSource({ source: key }).then((result) => {
      setIntegrations((current) =>
        current.map((integration) => (integration.key === key ? result.data.integration : integration))
      );
      setConnectingKey(null);
    });
  }

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
      <div className="atlas-meta">
        {STEP_ORDER.map((candidate, index) => (
          <span
            key={candidate}
            className={candidate === step ? "atlas-tag" : undefined}
            style={{ opacity: index <= stepIndex ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            {index < stepIndex ? <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" /> : `${index + 1}.`}{" "}
            {STEP_LABEL[candidate]}
          </span>
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
            Your region and a few body basics get a real nutrition plan generating right away - no
            connected app required. Everything you enter stays on this device.
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
              onClick={() => goTo("connect")}
              disabled={!profileSaved}
            >
              {profileSaved ? "Continue" : "Save above to continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "connect" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <HeartPulse size={22} strokeWidth={1.75} aria-hidden="true" />
            Connect your health apps
          </h2>
          <p className="atlas-note" style={{ color: "var(--atlas-warm)" }}>
            Strava&apos;s sign-in and sync are real, working code - it just needs a Strava API app
            registered first, under Settings → Integrations. Health Connect and Samsung Health are
            further behind: the phone-side code that would read them hasn&apos;t been built or
            tested on a real device yet, so skip those two for now if you just want a working
            setup.
          </p>
          <p className="atlas-note">
            Connecting an app brings in real activities, recovery, and sleep instead of sample
            data. Entirely optional - skip the rest, and add more anytime from Settings.
          </p>
          <div className="atlas-stack">
            {CONNECTOR_INFO.map((connector) => {
              const integration = integrations.find((item) => item.key === connector.key);
              const staged = integration?.connected ?? false;
              const connected = integration ? isFullyConnected(integration) : false;
              const pendingNote = integration ? pendingConnectionNote(integration) : null;
              const isConnecting = connectingKey === connector.key;

              return (
                <div key={connector.key} className="atlas-list-card">
                  <div
                    className="atlas-list-card__title"
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <connector.icon size={17} strokeWidth={2} aria-hidden="true" />
                    {connector.title}
                    <HintTooltip label={connector.hintLabel}>{connector.hint}</HintTooltip>
                  </div>
                  <div className="atlas-list-card__meta">{connector.detail}</div>
                  <div className="atlas-control-card__actions" style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      className="atlas-button atlas-button--secondary"
                      onClick={() => connectSource(connector.key)}
                      disabled={isConnecting || staged}
                    >
                      {staged ? "Requested" : isConnecting ? "Connecting..." : "Connect"}
                    </button>
                    {connected ? (
                      <span
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--atlas-accent)" }}
                      >
                        <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  {pendingNote ? <p className="atlas-note">{pendingNote}</p> : null}
                </div>
              );
            })}
          </div>
          <p className="atlas-note">
            Need the full sign-in flow, or want to disconnect something? Use{" "}
            <Link href="/settings/integrations">Settings &rarr; Integrations</Link> anytime.
          </p>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("profile")}>
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
            Atlas needs one of these set up before it can give real answers - pick whichever fits
            you, then Continue unlocks once it's confirmed. You can add the others, or change your
            mind, anytime from Settings.
          </p>
          <p className="atlas-note">
            Any key you enter goes straight from this device to that provider, and nowhere else -
            never through an Atlas server. We don&apos;t see it, store it remotely, or have any way
            to access it. Neither does anyone else.
          </p>

          {aiSettings.localOnlyMode ? (
            <p className="atlas-note">
              Local-only mode is enabled, so cloud options are disabled - on-device Ollama is the
              only available provider. Turn local-only mode off in Settings first if you want a
              cloud option.
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
                <div className="atlas-list-card__meta">Faster than most local hardware, and doesn't need anything installed.</div>
                <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                  <input
                    type="password"
                    value={groqKeyInput}
                    onChange={(event) => setGroqKeyInput(event.target.value)}
                    placeholder={aiSettings.groqApiKeySet ? "Key already saved - enter a new one to replace it" : "Groq API key"}
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
                    Sign in at ollama.com, then generate an API key for Ollama's hosted models - no
                    local install needed.{" "}
                    <a href={OLLAMA_CLOUD_KEYS_URL} target="_blank" rel="noreferrer">
                      Get a key
                    </a>
                  </HintTooltip>
                </div>
                <div className="atlas-list-card__meta">
                  Runs on Ollama's servers instead of this device - no local install needed.
                </div>
                <div className="atlas-form-field" style={{ marginTop: "10px" }}>
                  <input
                    type="password"
                    value={ollamaCloudKeyInput}
                    onChange={(event) => setOllamaCloudKeyInput(event.target.value)}
                    placeholder={
                      aiSettings.ollamaApiKeySet ? "Key already saved - enter a new one to replace it" : "Ollama Cloud API key"
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
              No key needed - just confirm Atlas can reach Ollama running on this machine.
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
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("connect")}>
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
            Not every food is in Atlas's product database yet. A Brave Search key lets Atlas fall
            back to the web so a lookup never comes up empty - this step is required to finish
            setup.
          </p>
          <p className="atlas-note">
            Same guarantee as your AI keys: this key goes straight from this device to Brave, never
            through an Atlas server, and we have no access to it.
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
                placeholder={braveConfigured ? "Key already saved - enter a new one to replace it" : "Brave Search API key"}
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
            Your nutrition plan is generating from the profile and market you just set. You can
            revisit any of this - including connecting a health app - from Settings at any time.
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
