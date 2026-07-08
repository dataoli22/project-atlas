"use client";

import { useState, useTransition } from "react";

import {
  getAppPreferencesData,
  saveAppPreferences,
  saveLocalizationSettings,
  saveProfileSettings
} from "@/lib/settings-data";
import { buildLocaleTag } from "@/lib/localization";
import type { LocalizationSettingsData, MarketOptionData, ProfileSettingsData } from "@/lib/settings-data";

type NutritionOnboardingFormProps = {
  initialProfile: ProfileSettingsData;
  initialLocalization: LocalizationSettingsData;
  markets: MarketOptionData[];
};

type OnboardingStep = "identity" | "metrics" | "market";
type FieldName =
  | "primaryGoal"
  | "profileType"
  | "activityLevel"
  | "hydration"
  | "bodyWeight"
  | "market"
  | "currency"
  | "language";

const STEP_ORDER: OnboardingStep[] = ["identity", "metrics", "market"];

const STEP_LABELS: Record<OnboardingStep, string> = {
  identity: "Identity",
  metrics: "Metrics",
  market: "Market"
};

const PROFILE_GUIDANCE: Record<string, string> = {
  general: "Keep this light: capture the basics now, then adapt nutrition and activity suggestions later.",
  runner: "Runner profiles will later map to training load, hydration, and recovery prompts from connected activity data.",
  cyclist: "Cyclist profiles will later map to ride fueling, hydration, and training summaries from connected apps.",
  multisport: "Multisport profiles should stay flexible so training and nutrition logic can blend across sports."
};

const STEP_FIELDS: Record<OnboardingStep, FieldName[]> = {
  identity: ["primaryGoal", "profileType"],
  metrics: ["activityLevel", "hydration", "bodyWeight"],
  market: ["market", "currency", "language"]
};

function getFieldError(
  field: FieldName,
  profile: ProfileSettingsData,
  localization: LocalizationSettingsData
) {
  const isSportProfile =
    profile.profileType === "runner" || profile.profileType === "cyclist" || profile.profileType === "multisport";

  if (field === "primaryGoal" && !profile.primaryGoal) {
    return "Add a primary goal.";
  }

  if (field === "profileType" && !profile.profileType) {
    return "Choose a profile type.";
  }

  if (field === "activityLevel" && !profile.activityLevel) {
    return "Choose an activity level.";
  }

  if (field === "hydration" && !profile.hydration) {
    return "Add a baseline hydration target.";
  }

  if (field === "bodyWeight" && isSportProfile && !profile.bodyWeight) {
    return "Body weight is required for sport-focused profiles.";
  }

  if (field === "market" && !localization.market) {
    return "Choose a supported market.";
  }

  if (field === "currency" && !localization.currency) {
    return "Currency could not be resolved.";
  }

  if (field === "language" && !localization.language) {
    return "Choose a language.";
  }

  return null;
}

function getStepRequirements(
  step: OnboardingStep,
  profile: ProfileSettingsData,
  localization: LocalizationSettingsData
) {
  if (step === "identity") {
    return [
      { label: "Primary goal", valid: Boolean(profile.primaryGoal) },
      { label: "Profile type", valid: Boolean(profile.profileType) }
    ];
  }

  if (step === "metrics") {
    const requiresWeight =
      profile.profileType === "runner" ||
      profile.profileType === "cyclist" ||
      profile.profileType === "multisport";

    return [
      { label: "Activity level", valid: Boolean(profile.activityLevel) },
      { label: "Hydration baseline", valid: Boolean(profile.hydration) },
      { label: "Body weight", valid: requiresWeight ? Boolean(profile.bodyWeight) : true }
    ];
  }

  return [
    { label: "Market", valid: Boolean(localization.market) },
    { label: "Currency", valid: Boolean(localization.currency) },
    { label: "Language", valid: Boolean(localization.language) }
  ];
}

export function NutritionOnboardingForm({
  initialProfile,
  initialLocalization,
  markets
}: NutritionOnboardingFormProps) {
  const [profile, setProfile] = useState<ProfileSettingsData>(initialProfile);
  const [localization, setLocalization] = useState<LocalizationSettingsData>(initialLocalization);
  const [activeStep, setActiveStep] = useState<OnboardingStep>("identity");
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState("Shared onboarding settings are ready to save.");
  const [isPending, startTransition] = useTransition();

  const selectedMarket =
    markets.find((market) => market.code === localization.market) ??
    markets[0];
  const isSportProfile =
    profile.profileType === "runner" || profile.profileType === "cyclist" || profile.profileType === "multisport";

  function touchFields(fields: FieldName[]) {
    setTouchedFields((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [field, true]))
    }));
  }

  function touchField(field: FieldName) {
    touchFields([field]);
  }

  function getVisibleFieldError(field: FieldName) {
    if (!touchedFields[field]) {
      return null;
    }

    return getFieldError(field, profile, localization);
  }

  function validateStep(step: OnboardingStep) {
    const stepErrors = STEP_FIELDS[step]
      .map((field) => getFieldError(field, profile, localization))
      .filter((error): error is Exclude<ReturnType<typeof getFieldError>, null> => error !== null);

    return stepErrors[0] ?? null;
  }

  function goToStep(step: OnboardingStep) {
    const blockingMessage = validateStep(activeStep);

    if (STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(activeStep) && blockingMessage) {
      touchFields(STEP_FIELDS[activeStep]);
      setStatus(blockingMessage);
      return;
    }

    setActiveStep(step);
    setStatus(`Editing ${STEP_LABELS[step].toLowerCase()} settings.`);
  }

  function updateMarket(nextMarketCode: MarketOptionData["code"]) {
    const nextMarket = markets.find((market) => market.code === nextMarketCode);

    if (!nextMarket) {
      return;
    }

    setLocalization({
      market: nextMarket.code,
      currency: nextMarket.defaultCurrency,
      language: nextMarket.defaultLanguage,
      locale: buildLocaleTag(nextMarket.defaultLanguage, nextMarket.code),
      supportedLanguages: nextMarket.supportedLanguages,
      currencyOverride: false,
      languageOverride: false
    });
    touchFields(["market", "currency", "language"]);
  }

  function updateLanguage(nextLanguage: LocalizationSettingsData["language"]) {
    setLocalization((current) => ({
      ...current,
      language: nextLanguage,
      locale: buildLocaleTag(nextLanguage, current.market),
      supportedLanguages: selectedMarket?.supportedLanguages ?? current.supportedLanguages,
      languageOverride: nextLanguage !== selectedMarket?.defaultLanguage
    }));
    touchField("language");
  }

  function saveAll() {
    startTransition(async () => {
      touchFields(STEP_FIELDS.identity);
      touchFields(STEP_FIELDS.metrics);
      touchFields(STEP_FIELDS.market);

      const blockingMessage = validateStep(activeStep) ?? validateStep("identity") ?? validateStep("metrics") ?? validateStep("market");

      if (blockingMessage) {
        setStatus(blockingMessage);
        return;
      }

      const currentPreferences = await getAppPreferencesData();
      const nextPreferences = {
        ...currentPreferences.data,
        sharedLocale: localization.locale
      };

      const [profileResult, localizationResult, preferenceResult] = await Promise.all([
        saveProfileSettings(profile),
        saveLocalizationSettings(localization),
        saveAppPreferences(nextPreferences)
      ]);

      setProfile(profileResult.data);
      setLocalization(localizationResult.data);
      window.dispatchEvent(
        new CustomEvent("atlas:preferences-updated", {
          detail: preferenceResult.data
        })
      );

      const sources = [profileResult.source, localizationResult.source, preferenceResult.source];
      setStatus(
        sources.every((source) => source === "api")
          ? "Saved through shared API settings endpoints."
          : "Saved locally with stub fallback for any unavailable endpoint."
      );
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Onboarding inputs</div>
      <p className="atlas-note">
        This form is modular by design: today it saves stub-backed shared settings, and later we can swap in live
        Samsung Health, Google Fit, Strava, and nutrition APIs without replacing the UI contract.
      </p>

      <div className="atlas-feature-switcher">
        {STEP_ORDER.map((step) => (
          <button
            key={step}
            type="button"
            className={activeStep === step ? "atlas-button atlas-button--active" : "atlas-button"}
            onClick={() => goToStep(step)}
          >
            {STEP_LABELS[step]}
          </button>
        ))}
      </div>

      {activeStep === "identity" ? (
        <div className="atlas-form-grid">
          <label className={getVisibleFieldError("primaryGoal") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Primary goal</span>
            <input
              type="text"
              value={profile.primaryGoal ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  primaryGoal: event.target.value || null
                }))
              }
              onBlur={() => touchField("primaryGoal")}
              aria-invalid={Boolean(getVisibleFieldError("primaryGoal"))}
              placeholder="Fat loss, performance, routine building..."
            />
            {getVisibleFieldError("primaryGoal") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("primaryGoal")}</small>
            ) : null}
          </label>

          <label className={getVisibleFieldError("profileType") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Profile type</span>
            <select
              value={profile.profileType ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  profileType: event.target.value || null
                }))
              }
              onBlur={() => touchField("profileType")}
              aria-invalid={Boolean(getVisibleFieldError("profileType"))}
            >
              <option value="">Select profile</option>
              <option value="general">General</option>
              <option value="runner">Runner</option>
              <option value="cyclist">Cyclist</option>
              <option value="multisport">Multisport</option>
            </select>
            {getVisibleFieldError("profileType") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("profileType")}</small>
            ) : null}
          </label>
        </div>
      ) : null}

      {activeStep === "metrics" ? (
        <div className="atlas-form-grid">
          <label className={getVisibleFieldError("activityLevel") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Activity level</span>
            <select
              value={profile.activityLevel ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  activityLevel: event.target.value || null
                }))
              }
              onBlur={() => touchField("activityLevel")}
              aria-invalid={Boolean(getVisibleFieldError("activityLevel"))}
            >
              <option value="">Select activity level</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="elite">Elite</option>
            </select>
            {getVisibleFieldError("activityLevel") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("activityLevel")}</small>
            ) : null}
          </label>

          <label className={getVisibleFieldError("hydration") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Hydration baseline (ml)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={profile.hydration?.amount ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  hydration: event.target.value
                    ? {
                        amount: Number(event.target.value),
                        unit: "ml",
                        source: current.hydration?.source ?? "user-input"
                      }
                  : null
                }))
              }
              onBlur={() => touchField("hydration")}
              aria-invalid={Boolean(getVisibleFieldError("hydration"))}
            />
            {getVisibleFieldError("hydration") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("hydration")}</small>
            ) : null}
          </label>

          <label className={getVisibleFieldError("bodyWeight") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Body weight (kg)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={profile.bodyWeight?.value ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  bodyWeight: event.target.value
                    ? {
                        value: Number(event.target.value),
                        unit: "kg",
                        source: current.bodyWeight?.source ?? "user-input"
                      }
                  : null
                }))
              }
              onBlur={() => touchField("bodyWeight")}
              aria-invalid={Boolean(getVisibleFieldError("bodyWeight"))}
            />
            {getVisibleFieldError("bodyWeight") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("bodyWeight")}</small>
            ) : null}
          </label>
        </div>
      ) : null}

      {activeStep === "market" ? (
        <div className="atlas-form-grid">
          <label className={getVisibleFieldError("market") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Market</span>
            <select
              value={localization.market}
              onChange={(event) => updateMarket(event.target.value as MarketOptionData["code"])}
              onBlur={() => touchField("market")}
              aria-invalid={Boolean(getVisibleFieldError("market"))}
            >
              {markets.map((market) => (
                <option key={market.code} value={market.code}>
                  {market.name}
                </option>
              ))}
            </select>
            {getVisibleFieldError("market") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("market")}</small>
            ) : null}
          </label>

          <label className={getVisibleFieldError("currency") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Currency</span>
            <input
              type="text"
              value={localization.currency}
              disabled
              readOnly
              aria-invalid={Boolean(getVisibleFieldError("currency"))}
            />
            {getVisibleFieldError("currency") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("currency")}</small>
            ) : null}
          </label>

          <label className={getVisibleFieldError("language") ? "atlas-form-field atlas-form-field--error" : "atlas-form-field"}>
            <span>Language</span>
            <select
              value={localization.language}
              onChange={(event) => updateLanguage(event.target.value as LocalizationSettingsData["language"])}
              onBlur={() => touchField("language")}
              aria-invalid={Boolean(getVisibleFieldError("language"))}
            >
              {selectedMarket.supportedLanguages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
            {getVisibleFieldError("language") ? (
              <small className="atlas-form-field__error">{getVisibleFieldError("language")}</small>
            ) : null}
          </label>
        </div>
      ) : null}

      <div className="atlas-list-card">
        <div className="atlas-list-card__title">Profile guidance</div>
        <div className="atlas-list-card__meta">
          {PROFILE_GUIDANCE[profile.profileType ?? "general"]}
        </div>
      </div>

      <div className="atlas-stack">
        {getStepRequirements(activeStep, profile, localization).map((requirement) => (
          <div key={`${activeStep}-${requirement.label}`} className="atlas-detail-list__row">
            <dt>{requirement.label}</dt>
            <dd>{requirement.valid ? "Ready" : "Required"}</dd>
          </div>
        ))}
      </div>

      <div className="atlas-detail-list__row">
        <dt>Resolved locale</dt>
        <dd>{localization.locale}</dd>
      </div>

      <p className="atlas-note">{status}</p>

      <div className="atlas-control-card__actions">
        {activeStep !== "identity" ? (
          <button
            type="button"
            className="atlas-button"
            onClick={() => goToStep(STEP_ORDER[STEP_ORDER.indexOf(activeStep) - 1])}
          >
            Back
          </button>
        ) : null}
        {activeStep !== "market" ? (
          <button
            type="button"
            className="atlas-button"
            onClick={() => goToStep(STEP_ORDER[STEP_ORDER.indexOf(activeStep) + 1])}
          >
            Continue
          </button>
        ) : null}
        <button
          type="button"
          className="atlas-button atlas-button--primary"
          onClick={saveAll}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save onboarding settings"}
        </button>
      </div>
    </section>
  );
}
