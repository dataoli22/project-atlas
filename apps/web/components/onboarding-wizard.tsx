"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { NutritionOnboardingForm } from "@/components/nutrition-onboarding-form";
import { completeOnboarding } from "@/lib/settings-data";
import type { LocalizationSettingsData, MarketOptionData, ProfileSettingsData } from "@/lib/settings-data";

type WizardStep = "welcome" | "profile" | "providers" | "finish";

const STEP_ORDER: WizardStep[] = ["welcome", "profile", "providers", "finish"];

const STEP_LABEL: Record<WizardStep, string> = {
  welcome: "Welcome",
  profile: "Profile & plan",
  providers: "Connect providers",
  finish: "Finish"
};

const PROVIDERS = [
  {
    title: "Strava",
    detail: "Syncs recent activities and training load for the endurance module."
  },
  {
    title: "Health Connect",
    detail: "Android bridge for recovery inputs - hydration, steps, active energy."
  },
  {
    title: "Samsung Health",
    detail: "Android bridge for sleep, resting heart rate, and energy score."
  }
];

type OnboardingWizardProps = {
  initialProfile: ProfileSettingsData;
  initialLocalization: LocalizationSettingsData;
  markets: MarketOptionData[];
};

export function OnboardingWizard({ initialProfile, initialLocalization, markets }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [profileSaved, setProfileSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      window.location.assign("/planner");
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
            style={{ opacity: index <= stepIndex ? 1 : 0.5 }}
          >
            {index + 1}. {STEP_LABEL[candidate]}
          </span>
        ))}
      </div>

      {step === "welcome" ? (
        <div className="atlas-stack">
          <h2 className="atlas-panel__title" style={{ fontSize: "1.4rem" }}>
            Set up Atlas on this device
          </h2>
          <p className="atlas-note">
            A few quick steps get your nutrition plan generating real data today. Health provider
            connections (Strava, Health Connect, Samsung Health) are entirely optional - skip them
            now and connect later from Settings whenever you want live endurance tracking.
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
              onClick={() => goTo("providers")}
              disabled={!profileSaved}
            >
              {profileSaved ? "Continue" : "Save above to continue"}
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
                <div className="atlas-list-card__title">{provider.title}</div>
                <div className="atlas-list-card__meta">{provider.detail}</div>
              </div>
            ))}
          </div>
          <div className="atlas-control-card__actions">
            <button type="button" className="atlas-button atlas-button--secondary" onClick={() => goTo("profile")}>
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
          <h2 className="atlas-panel__title" style={{ fontSize: "1.2rem" }}>
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
