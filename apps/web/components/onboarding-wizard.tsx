"use client";

import { BrainCircuit, CheckCircle2, CircleCheck, PartyPopper, Smartphone, UserCircle2, Watch, Zap } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { NutritionOnboardingForm } from "@/components/nutrition-onboarding-form";
import { completeOnboarding, saveAISettings, testAIRuntimeHealth } from "@/lib/settings-data";
import type { AISettingsData, LocalizationSettingsData, MarketOptionData, ProfileSettingsData } from "@/lib/settings-data";

type WizardStep = "welcome" | "profile" | "ai" | "providers" | "finish";

const STEP_ORDER: WizardStep[] = ["welcome", "profile", "ai", "providers", "finish"];

const STEP_LABEL: Record<WizardStep, string> = {
  welcome: "Welcome",
  profile: "Profile & plan",
  ai: "AI setup",
  providers: "Connect providers",
  finish: "Finish"
};

// At least one real AI path must be confirmed before continuing - either on-device Ollama
// verified reachable (needs no key at all, Atlas's zero-config default) or a cloud key entered
// (Groq, or Ollama pointed at a hosted endpoint). Chat falls back to a canned deterministic
// answer with neither, which is a poor first impression for a feature this central.
function hasWorkingAiPath(ai: AISettingsData, ollamaVerifiedReachable: boolean): boolean {
  return ollamaVerifiedReachable || ai.groqApiKeySet || ai.ollamaApiKeySet;
}

const PROVIDERS = [
  {
    title: "Strava",
    icon: Zap,
    detail: "Syncs recent activities and training load for the endurance module."
  },
  {
    title: "Health Connect",
    icon: Smartphone,
    detail: "Android bridge for recovery inputs - hydration, steps, active energy."
  },
  {
    title: "Samsung Health",
    icon: Watch,
    detail: "Android bridge for sleep, resting heart rate, and energy score."
  }
];

type OnboardingWizardProps = {
  initialProfile: ProfileSettingsData;
  initialLocalization: LocalizationSettingsData;
  markets: MarketOptionData[];
  initialAiSettings: AISettingsData;
};

export function OnboardingWizard({
  initialProfile,
  initialLocalization,
  markets,
  initialAiSettings
}: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [profileSaved, setProfileSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [aiSettings, setAiSettings] = useState(initialAiSettings);
  const [ollamaVerified, setOllamaVerified] = useState(false);
  const [ollamaCheckMessage, setOllamaCheckMessage] = useState<string | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [groqError, setGroqError] = useState<string | null>(null);
  const [isSavingGroq, setIsSavingGroq] = useState(false);

  const aiConfigured = hasWorkingAiPath(aiSettings, ollamaVerified);

  function checkOllama() {
    setIsCheckingOllama(true);
    setOllamaCheckMessage(null);
    testAIRuntimeHealth({
      ollamaBaseUrl: aiSettings.ollamaBaseUrl,
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

      {step === "welcome" ? (
        <div className="atlas-stack">
          <h2
            className="atlas-panel__title"
            style={{ fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <UserCircle2 size={26} strokeWidth={1.75} aria-hidden="true" />
            Set up Atlas on this device
          </h2>
          <p className="atlas-note">
            A few quick steps get your nutrition plan generating real data today and Ask Atlas
            actually answering questions. Health provider connections (Strava, Health Connect,
            Samsung Health) are entirely optional - skip them now and connect later from Settings
            whenever you want live endurance tracking.
          </p>
          <p className="atlas-note">
            Everything you enter stays on this device. Nothing is sent anywhere except whichever
            provider you explicitly connect, and never through an Atlas-hosted relay.
          </p>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("profile")}>
              Get started
            </button>
          </div>
        </div>
      ) : null}

      {step === "profile" ? (
        <div className="atlas-stack">
          <p className="atlas-note">
            This sets your market, currency, and body basics - the weekly nutrition plan generates
            immediately from these, no connector required.
          </p>
          <NutritionOnboardingForm
            initialProfile={initialProfile}
            initialLocalization={initialLocalization}
            markets={markets}
            onSaved={() => setProfileSaved(true)}
          />
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("welcome")}>
              Back
            </button>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={() => goTo("ai")}
              disabled={!profileSaved}
            >
              {profileSaved ? "Continue" : "Save above to continue"}
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
            Ask Atlas needs at least one working AI path before it can answer real questions -
            without one, chat only returns a canned deterministic reply. Pick either option below;
            you can add the other (or change your mind) anytime from Settings.
          </p>

          <div className="atlas-list-card">
            <div className="atlas-list-card__title">Option A: On-device Ollama (recommended, free, private)</div>
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

          {aiSettings.localOnlyMode ? (
            <p className="atlas-note">
              Local-only mode is enabled, so Groq is disabled - Ollama is the only available
              provider. Turn local-only mode off in Settings first if you want a cloud fallback.
            </p>
          ) : (
            <div className="atlas-list-card">
              <div className="atlas-list-card__title">Option B: Groq (cloud, free tier)</div>
              <div className="atlas-list-card__meta">
                Faster than most local hardware. The key is sent directly from this device to Groq
                - never through an Atlas-hosted relay.
              </div>
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
          )}

          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("profile")}>
              Back
            </button>
            <button
              type="button"
              className="atlas-button atlas-button--primary"
              onClick={() => goTo("providers")}
              disabled={!aiConfigured}
            >
              {aiConfigured ? "Continue" : "Set up at least one option to continue"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "providers" ? (
        <div className="atlas-stack">
          <h2 className="atlas-panel__title" style={{ fontSize: "1.2rem" }}>
            Connect health providers (optional)
          </h2>
          <p className="atlas-note">
            Connecting a provider unlocks live endurance tracking - synced activities, recovery,
            and sleep instead of illustrative example data. Entirely optional: skip this and Atlas
            works fully for nutrition today, and you can connect a provider anytime from Settings.
          </p>
          <div className="atlas-stack">
            {PROVIDERS.map((provider) => (
              <div key={provider.title} className="atlas-list-card">
                <div
                  className="atlas-list-card__title"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <provider.icon size={17} strokeWidth={2} aria-hidden="true" />
                  {provider.title}
                </div>
                <div className="atlas-list-card__meta">{provider.detail}</div>
              </div>
            ))}
          </div>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("ai")}>
              Back
            </button>
            <Link href="/settings/integrations" className="atlas-button atlas-button--secondary">
              Connect a provider now
            </Link>
            <button type="button" className="atlas-button atlas-button--primary" onClick={() => goTo("finish")}>
              Skip for now
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
            revisit any of this - including connecting a health provider - from Settings at any
            time.
          </p>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("providers")}>
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
