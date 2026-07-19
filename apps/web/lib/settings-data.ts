import {
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  DEFAULT_MARKET,
  SUPPORTED_MARKETS
} from "@atlas/config";
import {
  FEATURE_DEFINITIONS,
  type AppPreference,
  type AtlasFeature,
  type PlatformDensity
} from "@atlas/shared";

import { requestJson, type ApiDataSource } from "@/lib/api";
import { buildLocaleTag } from "@/lib/localization";

type SupportedMarket = (typeof SUPPORTED_MARKETS)[number];

export type MarketCode = SupportedMarket["code"];
export type CurrencyCode = SupportedMarket["currency"];
export type LanguageCode = SupportedMarket["languages"][number];

type DataEnvelope<T> = {
  data: T;
  source: ApiDataSource;
};

type FeatureApiResponse = {
  key: AtlasFeature;
  label: string;
  description: string;
  enabled: boolean;
};

type FeatureRegistryApiResponse = {
  active_feature: AtlasFeature;
  features: FeatureApiResponse[];
};

type AppPreferencesApiResponse = {
  active_feature: AtlasFeature;
  enabled_feature_flags: AtlasFeature[];
  preferred_platform_density: PlatformDensity;
  shared_locale: string;
  has_completed_onboarding?: boolean;
};

type SharedMetricApiResponse = {
  source: string;
};

type HydrationMetricApiResponse = SharedMetricApiResponse & {
  amount: number;
  unit: string;
};

type BodyWeightMetricApiResponse = SharedMetricApiResponse & {
  value: number;
  unit: string;
};

type ProfileSettingsApiResponse = {
  primary_goal: string | null;
  profile_type: string | null;
  activity_level: string | null;
  hydration: HydrationMetricApiResponse | null;
  body_weight: BodyWeightMetricApiResponse | null;
};

type LocalizationSettingsApiResponse = {
  market: MarketCode;
  currency: CurrencyCode;
  language: LanguageCode;
  locale: string;
  supported_languages: LanguageCode[];
  currency_override: boolean;
  language_override: boolean;
};

type MarketOptionApiResponse = {
  code: MarketCode;
  name: string;
  default_currency: CurrencyCode;
  default_language: LanguageCode;
  supported_languages: LanguageCode[];
};

type AgentPromptProfileApiResponse = {
  module: "shared" | "endurance" | "nutrition";
  title: string;
  system_prompt: string;
  guardrail_rules: string[];
  token_strategy_note: string;
  max_context_tokens: number;
  response_token_budget: number;
};

type AISettingsApiResponse = {
  default_provider: "ollama" | "groq";
  local_only_mode: boolean;
  self_hosted_distribution: boolean;
  allow_groq: boolean;
  ollama_base_url: string;
  ollama_model: string;
  ollama_embed_model: string;
  ollama_api_key_set: boolean;
  groq_model: string;
  groq_api_key_set: boolean;
  system_prompt_style: "token-lean" | "comprehensive-guarded";
  guardrail_level: "strict" | "maximum";
  max_context_items: number;
  max_context_tokens: number;
  response_token_budget: number;
  device_notice: string;
  prompt_profiles: AgentPromptProfileApiResponse[];
};

type AIRuntimeHealthCheckApiResponse = {
  ok: boolean;
  target: string;
  local_target: boolean;
  provider: "ollama";
  message: string;
  version: string | null;
  installed: boolean | null;
  model_checked: string | null;
  model_available: boolean | null;
  embed_model_checked: string | null;
  embed_model_available: boolean | null;
};

type OllamaPullApiResponse = {
  ok: boolean;
  model: string;
  message: string;
};

type IntegrationSourceKey = "strava" | "health_connect" | "samsung_health";

type IntegrationConnectMode = "oauth" | "device-permission" | "sdk-consent";

type IntegrationStatusApiResponse = {
  key: IntegrationSourceKey;
  title: string;
  connect_mode: IntegrationConnectMode;
  connected: boolean;
  status: string;
  account_label: string | null;
  login_hint: string;
  cta_label: string;
  doc_url: string;
  last_sync_at: string | null;
  notes: string[];
  runtime_summary: Record<string, string | number | boolean | null>;
};

type IntegrationConnectApiResponse = {
  integration: IntegrationStatusApiResponse;
  launch_url: string | null;
  local_only_notice: string;
};

type StravaCallbackApiResponse = {
  integration: IntegrationStatusApiResponse;
  token_exchange_ready: boolean;
  token_exchange_status: string;
  local_only_notice: string;
};

type StravaTokenExchangeApiResponse = {
  integration: IntegrationStatusApiResponse;
  token_exchange_status: string;
  access_token_set: boolean;
  refresh_token_set: boolean;
  expires_at: number | null;
  athlete_id: string | null;
  local_only_notice: string;
};

export type FeatureSummary = {
  key: AtlasFeature;
  label: string;
  description: string;
  enabled: boolean;
};

export type FeatureRegistryData = {
  activeFeature: AtlasFeature;
  features: FeatureSummary[];
};

export type AppPreferencesData = AppPreference;

export type ProfileSettingsData = {
  primaryGoal: string | null;
  profileType: string | null;
  activityLevel: string | null;
  hydration: HydrationMetricApiResponse | null;
  bodyWeight: BodyWeightMetricApiResponse | null;
};

export type LocalizationSettingsData = {
  market: MarketCode;
  currency: CurrencyCode;
  language: LanguageCode;
  locale: string;
  supportedLanguages: LanguageCode[];
  currencyOverride: boolean;
  languageOverride: boolean;
};

export type MarketOptionData = {
  code: MarketCode;
  name: string;
  defaultCurrency: CurrencyCode;
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
};

export type AgentPromptProfileData = AgentPromptProfileApiResponse;

export type AISettingsData = {
  defaultProvider: "ollama" | "groq";
  localOnlyMode: boolean;
  selfHostedDistribution: boolean;
  allowGroq: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaEmbedModel: string;
  ollamaApiKeySet: boolean;
  groqModel: string;
  groqApiKeySet: boolean;
  systemPromptStyle: "token-lean" | "comprehensive-guarded";
  guardrailLevel: "strict" | "maximum";
  maxContextItems: number;
  maxContextTokens: number;
  responseTokenBudget: number;
  deviceNotice: string;
  promptProfiles: AgentPromptProfileData[];
};

export type AIRuntimeHealthCheckData = {
  ok: boolean;
  target: string;
  localTarget: boolean;
  provider: "ollama";
  message: string;
  version: string | null;
  installed: boolean | null;
  modelChecked: string | null;
  modelAvailable: boolean | null;
  embedModelChecked: string | null;
  embedModelAvailable: boolean | null;
};

export type OllamaPullData = {
  ok: boolean;
  model: string;
  message: string;
};

export type IntegrationSourceData = {
  key: IntegrationSourceKey;
  title: string;
  connectMode: IntegrationConnectMode;
  connected: boolean;
  status: string;
  accountLabel: string | null;
  loginHint: string;
  ctaLabel: string;
  docUrl: string;
  lastSyncAt: string | null;
  notes: string[];
  runtimeSummary: Record<string, string | number | boolean | null>;
};

export type IntegrationConnectData = {
  integration: IntegrationSourceData;
  launchUrl: string | null;
  localOnlyNotice: string;
};

export type StravaCallbackData = {
  integration: IntegrationSourceData;
  tokenExchangeReady: boolean;
  tokenExchangeStatus: string;
  localOnlyNotice: string;
};

export type StravaTokenExchangeData = {
  integration: IntegrationSourceData;
  tokenExchangeStatus: string;
  accessTokenSet: boolean;
  refreshTokenSet: boolean;
  expiresAt: number | null;
  athleteId: string | null;
  localOnlyNotice: string;
};

export type SettingsPageData = {
  featureRegistry: DataEnvelope<FeatureRegistryData>;
  appPreferences: DataEnvelope<AppPreferencesData>;
  localization: DataEnvelope<LocalizationSettingsData>;
  profile: DataEnvelope<ProfileSettingsData>;
  markets: DataEnvelope<MarketOptionData[]>;
  ai: DataEnvelope<AISettingsData>;
};

export type OnboardingPageData = SettingsPageData & {
  selectedMarket: MarketOptionData;
};

const featureRegistryFallback: FeatureRegistryApiResponse = {
  active_feature: "endurance",
  features: FEATURE_DEFINITIONS.map((feature) => ({
    key: feature.key,
    label: feature.label,
    description: feature.description,
    enabled: true
  }))
};

const profileFallback: ProfileSettingsApiResponse = {
  primary_goal: "Build durable health routines",
  profile_type: "general",
  activity_level: "moderate",
  hydration: {
    amount: 2500,
    unit: "ml",
    source: "shared-default"
  },
  body_weight: {
    value: 70,
    unit: "kg",
    source: "shared-default"
  }
};

const localizationFallback: LocalizationSettingsApiResponse = {
  market: DEFAULT_MARKET,
  currency: DEFAULT_CURRENCY,
  language: DEFAULT_LANGUAGE,
  locale: buildLocaleTag(DEFAULT_LANGUAGE, DEFAULT_MARKET),
  supported_languages: [
    ...(SUPPORTED_MARKETS.find((market) => market.code === DEFAULT_MARKET)?.languages ?? [DEFAULT_LANGUAGE])
  ],
  currency_override: false,
  language_override: false
};

const marketsFallback: MarketOptionApiResponse[] = SUPPORTED_MARKETS.map((market) => ({
  code: market.code,
  name: market.label,
  default_currency: market.currency,
  default_language: market.languages[0],
  supported_languages: [...market.languages]
}));

type SearchSettingsApiResponse = {
  brave_api_key_set: boolean;
};

export type SearchSettingsData = {
  braveApiKeySet: boolean;
};

const searchSettingsFallback: SearchSettingsApiResponse = {
  brave_api_key_set: false
};

function mapSearchSettings(response: SearchSettingsApiResponse): SearchSettingsData {
  return { braveApiKeySet: response.brave_api_key_set };
}

export async function getSearchSettingsData(): Promise<DataEnvelope<SearchSettingsData>> {
  const result = await requestJson<SearchSettingsApiResponse>("/api/v1/settings/search", {
    fallback: searchSettingsFallback
  });

  return {
    data: mapSearchSettings(result.data),
    source: result.source
  };
}

export async function saveSearchSettings(
  update: { braveApiKey?: string; clearBraveApiKey?: boolean }
): Promise<DataEnvelope<SearchSettingsData>> {
  const payload = {
    brave_api_key: update.braveApiKey,
    clear_brave_api_key: update.clearBraveApiKey ?? false
  };

  const fallback: SearchSettingsApiResponse = {
    brave_api_key_set: payload.clear_brave_api_key ? false : Boolean(update.braveApiKey)
  };

  const result = await requestJson<SearchSettingsApiResponse>("/api/v1/settings/search", {
    method: "PUT",
    body: payload,
    fallback
  });

  return {
    data: mapSearchSettings(result.data),
    source: result.source
  };
}

type StravaAppSettingsApiResponse = {
  client_id_set: boolean;
  client_secret_set: boolean;
  redirect_uri: string;
  scopes: string;
};

export type StravaAppSettingsData = {
  clientIdSet: boolean;
  clientSecretSet: boolean;
  redirectUri: string;
  scopes: string;
};

const stravaAppSettingsFallback: StravaAppSettingsApiResponse = {
  client_id_set: false,
  client_secret_set: false,
  redirect_uri: "",
  scopes: "read,activity:read_all"
};

function mapStravaAppSettings(response: StravaAppSettingsApiResponse): StravaAppSettingsData {
  return {
    clientIdSet: response.client_id_set,
    clientSecretSet: response.client_secret_set,
    redirectUri: response.redirect_uri,
    scopes: response.scopes
  };
}

export async function getStravaAppSettingsData(): Promise<DataEnvelope<StravaAppSettingsData>> {
  const result = await requestJson<StravaAppSettingsApiResponse>("/api/v1/settings/strava", {
    fallback: stravaAppSettingsFallback
  });

  return {
    data: mapStravaAppSettings(result.data),
    source: result.source
  };
}

export async function saveStravaAppSettings(
  update: {
    clientId?: string;
    clearClientId?: boolean;
    clientSecret?: string;
    clearClientSecret?: boolean;
  }
): Promise<DataEnvelope<StravaAppSettingsData>> {
  const payload = {
    client_id: update.clientId,
    clear_client_id: update.clearClientId ?? false,
    client_secret: update.clientSecret,
    clear_client_secret: update.clearClientSecret ?? false
  };

  const fallback: StravaAppSettingsApiResponse = {
    ...stravaAppSettingsFallback,
    client_id_set: payload.clear_client_id ? false : Boolean(update.clientId),
    client_secret_set: payload.clear_client_secret ? false : Boolean(update.clientSecret)
  };

  const result = await requestJson<StravaAppSettingsApiResponse>("/api/v1/settings/strava", {
    method: "PUT",
    body: payload,
    fallback
  });

  return {
    data: mapStravaAppSettings(result.data),
    source: result.source
  };
}

const aiSettingsFallback: AISettingsApiResponse = {
  default_provider: "ollama",
  local_only_mode: true,
  self_hosted_distribution: true,
  allow_groq: false,
  ollama_base_url: "http://localhost:11434",
  ollama_model: "llama3.1:8b",
  ollama_embed_model: "nomic-embed-text",
  ollama_api_key_set: false,
  groq_model: "llama-3.1-8b-instant",
  groq_api_key_set: false,
  system_prompt_style: "token-lean",
  guardrail_level: "strict",
  max_context_items: 6,
  max_context_tokens: 2400,
  response_token_budget: 450,
  device_notice:
    "Atlas is configured for device-local operation. Provider keys stay on the same phone or desktop that runs the app, and Ollama remains the default fully local provider. If Groq is enabled, requests leave the device only to Groq directly from this user-owned runtime.",
  prompt_profiles: [
    {
      module: "shared",
      title: "Shared shell agent",
      system_prompt:
        "You are Atlas, a local device-only health copilot. Use only provided facts. No invention, no diagnosis, no secrets. Prefer 3-6 short bullets and one next action.",
      guardrail_rules: [
        "Use only provided structured signals and deterministic calculations.",
        "State uncertainty clearly when data is missing or sparse.",
        "Do not provide diagnosis, emergency triage, or medication advice.",
        "Keep answers concise unless the user explicitly asks for depth.",
        "Prefer bullets, thresholds, and next actions over long narrative filler."
      ],
      token_strategy_note:
        "Minimize token use by sending only approved summaries, top signals, and one answer shape at a time.",
      max_context_tokens: 2400,
      response_token_budget: 450
    },
    {
      module: "endurance",
      title: "Endurance coach agent",
      system_prompt:
        "You are the Atlas endurance agent. Explain training and recovery from computed metrics only. Be specific, cautious, and brief.",
      guardrail_rules: [
        "Use only provided structured signals and deterministic calculations.",
        "State uncertainty clearly when data is missing or sparse.",
        "Do not provide diagnosis, emergency triage, or medication advice.",
        "Keep answers concise unless the user explicitly asks for depth.",
        "Prefer bullets, thresholds, and next actions over long narrative filler."
      ],
      token_strategy_note:
        "Send derived metrics, top timeline events, and at most a few recent insights instead of raw history.",
      max_context_tokens: 2400,
      response_token_budget: 450
    },
    {
      module: "nutrition",
      title: "Nutrition planner agent",
      system_prompt:
        "You are the Atlas nutrition agent. Explain plan, cost, shopping, and cooking outputs only. No invented prices or nutrition math. Stay practical and concise.",
      guardrail_rules: [
        "Use only provided structured signals and deterministic calculations.",
        "State uncertainty clearly when data is missing or sparse.",
        "Do not provide diagnosis, emergency triage, or medication advice.",
        "Keep answers concise unless the user explicitly asks for depth.",
        "Prefer bullets, thresholds, and next actions over long narrative filler."
      ],
      token_strategy_note:
        "Send finalized plan summaries, shopping totals, and substitution candidates instead of full recipe corpora.",
      max_context_tokens: 2400,
      response_token_budget: 450
    }
  ]
};

const integrationsFallback: IntegrationStatusApiResponse[] = [
  {
    key: "strava",
    title: "Strava",
    connect_mode: "oauth",
    connected: false,
    status: "disconnected",
    account_label: null,
    login_hint: "Use a Strava account email or athlete label before launching OAuth.",
    cta_label: "Connect Strava account",
    doc_url: "https://developers.strava.com/docs/authentication/",
    last_sync_at: null,
    runtime_summary: {},
    notes: [
      "Real implementation will launch Strava OAuth from the packaged desktop or phone runtime.",
      "This stub keeps the UI and API contract ready for later token exchange work."
    ]
  },
  {
    key: "health_connect",
    title: "Health Connect",
    connect_mode: "device-permission",
    connected: false,
    status: "disconnected",
    account_label: null,
    login_hint: "Health Connect uses Android device permissions rather than a separate web login.",
    cta_label: "Authorize Health Connect",
    doc_url: "https://developer.android.com/health-and-fitness/guides/health-connect",
    last_sync_at: null,
    runtime_summary: {},
    notes: [
      "Real implementation will request local Android permissions from the app package.",
      "Google Fit style history should flow through Health Connect where available."
    ]
  },
  {
    key: "samsung_health",
    title: "Samsung Health",
    connect_mode: "sdk-consent",
    connected: false,
    status: "disconnected",
    account_label: null,
    login_hint: "Samsung Health relies on SDK consent inside the device app flow.",
    cta_label: "Grant Samsung Health consent",
    doc_url: "https://developer.samsung.com/health/android",
    last_sync_at: null,
    runtime_summary: {},
    notes: [
      "Real implementation will use the Samsung Health SDK inside the packaged app.",
      "Consent and sync remain local to the user-owned device runtime."
    ]
  }
];

function mapFeatureRegistry(response: FeatureRegistryApiResponse): FeatureRegistryData {
  return {
    activeFeature: response.active_feature,
    features: response.features.map((feature) => ({
      key: feature.key,
      label: feature.label,
      description: feature.description,
      enabled: feature.enabled
    }))
  };
}

function mapProfile(response: ProfileSettingsApiResponse): ProfileSettingsData {
  return {
    primaryGoal: response.primary_goal,
    profileType: response.profile_type,
    activityLevel: response.activity_level,
    hydration: response.hydration,
    bodyWeight: response.body_weight
  };
}

function mapLocalization(response: LocalizationSettingsApiResponse): LocalizationSettingsData {
  return {
    market: response.market,
    currency: response.currency,
    language: response.language,
    locale: response.locale,
    supportedLanguages: response.supported_languages,
    currencyOverride: response.currency_override,
    languageOverride: response.language_override
  };
}

function mapMarket(response: MarketOptionApiResponse): MarketOptionData {
  return {
    code: response.code,
    name: response.name,
    defaultCurrency: response.default_currency,
    defaultLanguage: response.default_language,
    supportedLanguages: response.supported_languages
  };
}

function mapAISettings(response: AISettingsApiResponse): AISettingsData {
  return {
    defaultProvider: response.default_provider,
    localOnlyMode: response.local_only_mode,
    selfHostedDistribution: response.self_hosted_distribution,
    allowGroq: response.allow_groq,
    ollamaBaseUrl: response.ollama_base_url,
    ollamaModel: response.ollama_model,
    ollamaEmbedModel: response.ollama_embed_model,
    ollamaApiKeySet: response.ollama_api_key_set,
    groqModel: response.groq_model,
    groqApiKeySet: response.groq_api_key_set,
    systemPromptStyle: response.system_prompt_style,
    guardrailLevel: response.guardrail_level,
    maxContextItems: response.max_context_items,
    maxContextTokens: response.max_context_tokens,
    responseTokenBudget: response.response_token_budget,
    deviceNotice: response.device_notice,
    promptProfiles: response.prompt_profiles
  };
}

function mapAIRuntimeHealthCheck(
  response: AIRuntimeHealthCheckApiResponse
): AIRuntimeHealthCheckData {
  return {
    ok: response.ok,
    target: response.target,
    localTarget: response.local_target,
    provider: response.provider,
    message: response.message,
    version: response.version,
    installed: response.installed,
    modelChecked: response.model_checked,
    modelAvailable: response.model_available,
    embedModelChecked: response.embed_model_checked,
    embedModelAvailable: response.embed_model_available
  };
}

function mapOllamaPull(response: OllamaPullApiResponse): OllamaPullData {
  return {
    ok: response.ok,
    model: response.model,
    message: response.message
  };
}

function mapIntegration(response: IntegrationStatusApiResponse): IntegrationSourceData {
  return {
    key: response.key,
    title: response.title,
    connectMode: response.connect_mode,
    connected: response.connected,
    status: response.status,
    accountLabel: response.account_label,
    loginHint: response.login_hint,
    ctaLabel: response.cta_label,
    docUrl: response.doc_url,
    lastSyncAt: response.last_sync_at,
    notes: response.notes,
    runtimeSummary: response.runtime_summary
  };
}

function mapIntegrationConnect(response: IntegrationConnectApiResponse): IntegrationConnectData {
  return {
    integration: mapIntegration(response.integration),
    launchUrl: response.launch_url,
    localOnlyNotice: response.local_only_notice
  };
}

function mapStravaCallback(response: StravaCallbackApiResponse): StravaCallbackData {
  return {
    integration: mapIntegration(response.integration),
    tokenExchangeReady: response.token_exchange_ready,
    tokenExchangeStatus: response.token_exchange_status,
    localOnlyNotice: response.local_only_notice
  };
}

function mapStravaTokenExchange(response: StravaTokenExchangeApiResponse): StravaTokenExchangeData {
  return {
    integration: mapIntegration(response.integration),
    tokenExchangeStatus: response.token_exchange_status,
    accessTokenSet: response.access_token_set,
    refreshTokenSet: response.refresh_token_set,
    expiresAt: response.expires_at,
    athleteId: response.athlete_id,
    localOnlyNotice: response.local_only_notice
  };
}

export async function getFeatureRegistryData(): Promise<DataEnvelope<FeatureRegistryData>> {
  const result = await requestJson<FeatureRegistryApiResponse>("/api/v1/app/features", {
    fallback: featureRegistryFallback
  });

  return {
    data: mapFeatureRegistry(result.data),
    source: result.source
  };
}

export async function getAppPreferencesData(): Promise<DataEnvelope<AppPreferencesData>> {
  const fallback: AppPreferencesApiResponse = {
    active_feature: "nutrition",
    enabled_feature_flags: FEATURE_DEFINITIONS.map((feature) => feature.key),
    preferred_platform_density: "comfortable",
    shared_locale: localizationFallback.locale,
    // Fallback only fires when the local API is unreachable - defaulting this to true prevents
    // an offline/unreachable backend from trapping the user behind an onboarding gate they have
    // no way to submit through.
    has_completed_onboarding: true
  };

  const result = await requestJson<AppPreferencesApiResponse>("/api/v1/app/preferences", {
    fallback
  });

  return {
    data: {
      activeFeature: result.data.active_feature,
      enabledFeatureFlags: result.data.enabled_feature_flags,
      preferredPlatformDensity: result.data.preferred_platform_density,
      sharedLocale: result.data.shared_locale,
      hasCompletedOnboarding: result.data.has_completed_onboarding ?? true
    },
    source: result.source
  };
}

export async function saveAppPreferences(
  preferences: AppPreferencesData
): Promise<DataEnvelope<AppPreferencesData>> {
  const payload: AppPreferencesApiResponse = {
    active_feature: preferences.activeFeature,
    enabled_feature_flags: preferences.enabledFeatureFlags,
    preferred_platform_density: preferences.preferredPlatformDensity,
    shared_locale: preferences.sharedLocale
  };

  const result = await requestJson<AppPreferencesApiResponse>("/api/v1/app/preferences", {
    method: "PUT",
    body: payload,
    fallback: payload
  });

  return {
    data: {
      activeFeature: result.data.active_feature,
      enabledFeatureFlags: result.data.enabled_feature_flags,
      preferredPlatformDensity: result.data.preferred_platform_density,
      sharedLocale: result.data.shared_locale,
      hasCompletedOnboarding: result.data.has_completed_onboarding ?? preferences.hasCompletedOnboarding
    },
    source: result.source
  };
}

export async function completeOnboarding(): Promise<DataEnvelope<AppPreferencesData>> {
  const fallback: AppPreferencesApiResponse = {
    active_feature: "nutrition",
    enabled_feature_flags: FEATURE_DEFINITIONS.map((feature) => feature.key),
    preferred_platform_density: "comfortable",
    shared_locale: localizationFallback.locale,
    has_completed_onboarding: true
  };

  const result = await requestJson<AppPreferencesApiResponse>("/api/v1/app/onboarding/complete", {
    method: "POST",
    fallback
  });

  return {
    data: {
      activeFeature: result.data.active_feature,
      enabledFeatureFlags: result.data.enabled_feature_flags,
      preferredPlatformDensity: result.data.preferred_platform_density,
      sharedLocale: result.data.shared_locale,
      hasCompletedOnboarding: result.data.has_completed_onboarding ?? true
    },
    source: result.source
  };
}

export async function getProfileSettingsData(): Promise<DataEnvelope<ProfileSettingsData>> {
  const result = await requestJson<ProfileSettingsApiResponse>("/api/v1/settings/profile", {
    fallback: profileFallback
  });

  return {
    data: mapProfile(result.data),
    source: result.source
  };
}

export async function saveProfileSettings(
  profile: ProfileSettingsData
): Promise<DataEnvelope<ProfileSettingsData>> {
  const payload: ProfileSettingsApiResponse = {
    primary_goal: profile.primaryGoal,
    profile_type: profile.profileType,
    activity_level: profile.activityLevel,
    hydration: profile.hydration,
    body_weight: profile.bodyWeight
  };

  const result = await requestJson<ProfileSettingsApiResponse>("/api/v1/settings/profile", {
    method: "PUT",
    body: payload,
    fallback: payload
  });

  return {
    data: mapProfile(result.data),
    source: result.source
  };
}

export async function getLocalizationSettingsData(): Promise<DataEnvelope<LocalizationSettingsData>> {
  const result = await requestJson<LocalizationSettingsApiResponse>("/api/v1/settings/localization", {
    fallback: localizationFallback
  });

  return {
    data: mapLocalization(result.data),
    source: result.source
  };
}

export async function saveLocalizationSettings(
  localization: LocalizationSettingsData
): Promise<DataEnvelope<LocalizationSettingsData>> {
  const payload: LocalizationSettingsApiResponse = {
    market: localization.market,
    currency: localization.currency,
    language: localization.language,
    locale: localization.locale,
    supported_languages: localization.supportedLanguages,
    currency_override: localization.currencyOverride,
    language_override: localization.languageOverride
  };

  const result = await requestJson<LocalizationSettingsApiResponse>("/api/v1/settings/localization", {
    method: "PUT",
    body: payload,
    fallback: payload
  });

  return {
    data: mapLocalization(result.data),
    source: result.source
  };
}

export async function getMarketOptionsData(): Promise<DataEnvelope<MarketOptionData[]>> {
  const result = await requestJson<MarketOptionApiResponse[]>("/api/v1/settings/markets", {
    fallback: marketsFallback
  });

  return {
    data: result.data.map(mapMarket),
    source: result.source
  };
}

export async function getAISettingsData(): Promise<DataEnvelope<AISettingsData>> {
  const result = await requestJson<AISettingsApiResponse>("/api/v1/settings/ai", {
    fallback: aiSettingsFallback
  });

  return {
    data: mapAISettings(result.data),
    source: result.source
  };
}

export async function saveAISettings(
  ai: AISettingsData & {
    ollamaApiKey?: string;
    clearOllamaApiKey?: boolean;
    groqApiKey?: string;
    clearGroqApiKey?: boolean;
  }
): Promise<DataEnvelope<AISettingsData>> {
  const payload = {
    default_provider: ai.defaultProvider,
    local_only_mode: ai.localOnlyMode,
    self_hosted_distribution: ai.selfHostedDistribution,
    allow_groq: ai.allowGroq,
    ollama_base_url: ai.ollamaBaseUrl,
    ollama_model: ai.ollamaModel,
    ollama_embed_model: ai.ollamaEmbedModel,
    ollama_api_key: ai.ollamaApiKey,
    clear_ollama_api_key: ai.clearOllamaApiKey ?? false,
    groq_model: ai.groqModel,
    groq_api_key: ai.groqApiKey,
    clear_groq_api_key: ai.clearGroqApiKey ?? false,
    system_prompt_style: ai.systemPromptStyle,
    guardrail_level: ai.guardrailLevel,
    max_context_items: ai.maxContextItems,
    max_context_tokens: ai.maxContextTokens,
    response_token_budget: ai.responseTokenBudget
  };

  const fallback: AISettingsApiResponse = {
    ...aiSettingsFallback,
    default_provider: payload.default_provider,
    local_only_mode: payload.local_only_mode,
    self_hosted_distribution: payload.self_hosted_distribution,
    allow_groq: payload.allow_groq,
    ollama_base_url: payload.ollama_base_url,
    ollama_model: payload.ollama_model,
    ollama_embed_model: payload.ollama_embed_model,
    ollama_api_key_set: payload.clear_ollama_api_key ? false : ai.ollamaApiKeySet || Boolean(ai.ollamaApiKey),
    groq_model: payload.groq_model,
    groq_api_key_set: payload.clear_groq_api_key ? false : ai.groqApiKeySet || Boolean(ai.groqApiKey),
    system_prompt_style: payload.system_prompt_style,
    guardrail_level: payload.guardrail_level,
    max_context_items: payload.max_context_items,
    max_context_tokens: payload.max_context_tokens,
    response_token_budget: payload.response_token_budget
  };

  const result = await requestJson<AISettingsApiResponse>("/api/v1/settings/ai", {
    method: "PUT",
    body: payload,
    fallback
  });

  return {
    data: mapAISettings(result.data),
    source: result.source
  };
}

export async function testAIRuntimeHealth(
  ai: Pick<AISettingsData, "ollamaBaseUrl" | "ollamaModel" | "ollamaEmbedModel"> & {
    ollamaApiKey?: string;
  }
): Promise<DataEnvelope<AIRuntimeHealthCheckData>> {
  const payload = {
    ollama_base_url: ai.ollamaBaseUrl,
    ollama_model: ai.ollamaModel,
    ollama_embed_model: ai.ollamaEmbedModel,
    ollama_api_key: ai.ollamaApiKey?.trim() ? ai.ollamaApiKey : undefined
  };

  const fallback: AIRuntimeHealthCheckApiResponse = {
    ok: false,
    target: ai.ollamaBaseUrl,
    local_target: ai.ollamaBaseUrl.includes("localhost") || ai.ollamaBaseUrl.includes("127.0.0.1"),
    provider: "ollama",
    message:
      "Atlas could not reach its local settings API from this page, so the Ollama test stayed in local-only fallback mode.",
    version: null,
    installed: null,
    model_checked: ai.ollamaModel,
    model_available: null,
    embed_model_checked: ai.ollamaEmbedModel,
    embed_model_available: null
  };

  const result = await requestJson<AIRuntimeHealthCheckApiResponse>("/api/v1/settings/ai/health", {
    method: "POST",
    body: payload,
    fallback
  });

  return {
    data: mapAIRuntimeHealthCheck(result.data),
    source: result.source
  };
}

export async function pullOllamaModel(input: {
  model: string;
  ollamaBaseUrl: string;
  ollamaApiKey?: string;
}): Promise<DataEnvelope<OllamaPullData>> {
  const payload = {
    model: input.model,
    ollama_base_url: input.ollamaBaseUrl,
    ollama_api_key: input.ollamaApiKey?.trim() ? input.ollamaApiKey : undefined
  };

  const fallback: OllamaPullApiResponse = {
    ok: false,
    model: input.model,
    message: "Atlas could not reach its local settings API from this page, so the pull request did not run."
  };

  const result = await requestJson<OllamaPullApiResponse>("/api/v1/settings/ai/pull", {
    method: "POST",
    body: payload,
    fallback
  });

  return {
    data: mapOllamaPull(result.data),
    source: result.source
  };
}

export async function getIntegrationSourcesData(): Promise<DataEnvelope<IntegrationSourceData[]>> {
  const result = await requestJson<IntegrationStatusApiResponse[]>("/api/v1/integrations", {
    fallback: integrationsFallback
  });

  return {
    data: result.data.map(mapIntegration),
    source: result.source
  };
}

export async function connectIntegrationSource(input: {
  source: IntegrationSourceKey;
  accountLabel?: string;
  loginIdentifier?: string;
}): Promise<DataEnvelope<IntegrationConnectData>> {
  const fallbackIntegration =
    integrationsFallback.find((integration) => integration.key === input.source) ?? integrationsFallback[0];
  const fallback: IntegrationConnectApiResponse = {
    integration: {
      ...fallbackIntegration,
      connected: true,
      status:
        input.source === "strava"
          ? "oauth-ready"
          : input.source === "health_connect"
            ? "device-permission-required"
            : "sdk-consent-required",
      account_label: input.accountLabel || input.loginIdentifier || fallbackIntegration.account_label
    },
    launch_url: fallbackIntegration.doc_url,
    local_only_notice:
      "Atlas stayed in stub fallback mode on this page, but the connection contract remains local-first and replaceable."
  };

  const result = await requestJson<IntegrationConnectApiResponse>(
    `/api/v1/integrations/${input.source}/connect`,
    {
      method: "POST",
      body: {
        account_label: input.accountLabel,
        login_identifier: input.loginIdentifier
      },
      fallback
    }
  );

  return {
    data: mapIntegrationConnect(result.data),
    source: result.source
  };
}

export async function disconnectIntegrationSource(
  source: IntegrationSourceKey
): Promise<DataEnvelope<IntegrationConnectData>> {
  const fallbackIntegration =
    integrationsFallback.find((integration) => integration.key === source) ?? integrationsFallback[0];
  const fallback: IntegrationConnectApiResponse = {
    integration: {
      ...fallbackIntegration,
      connected: false,
      status: "disconnected",
      account_label: null,
      last_sync_at: null
    },
    launch_url: null,
    local_only_notice: "Atlas disconnected the stub contract locally because the backend was unavailable."
  };

  const result = await requestJson<IntegrationConnectApiResponse>(
    `/api/v1/integrations/${source}/disconnect`,
    {
      method: "POST",
      body: { confirm: true },
      fallback
    }
  );

  return {
    data: mapIntegrationConnect(result.data),
    source: result.source
  };
}

export async function syncIntegrationSource(
  source: IntegrationSourceKey
): Promise<DataEnvelope<IntegrationConnectData>> {
  const fallbackIntegration =
    integrationsFallback.find((integration) => integration.key === source) ?? integrationsFallback[0];
  const runtimeSummary =
    source === "health_connect"
      ? {
          permission_granted: true,
          connected_device_label: fallbackIntegration.account_label ?? "This device",
          hydration_ml: 2400,
          body_weight_kg: 69.8,
          step_count: 10840,
          active_energy_kcal: 684,
          synced_session_count: 2,
          bridge_source: "local-stub",
          sync_mode: "permissions-local-stub"
        }
      : source === "samsung_health"
        ? {
            consent_granted: true,
            connected_device_label: fallbackIntegration.account_label ?? "Samsung Health on this device",
            supported_metric_count: 5,
            sleep_hours: 7.4,
            resting_hr: 52,
            energy_score: 82,
            stress_level: "Low",
            synced_session_count: 2,
            bridge_source: "local-stub",
            sync_mode: "sdk-local-stub"
          }
        : fallbackIntegration.runtime_summary;
  const fallback: IntegrationConnectApiResponse = {
    integration: {
      ...fallbackIntegration,
      connected: true,
      status: "sync-stubbed",
      last_sync_at: new Date().toISOString(),
      runtime_summary: runtimeSummary
    },
    launch_url: null,
    local_only_notice: "Atlas simulated a local stub sync because the backend was unavailable."
  };

  const result = await requestJson<IntegrationConnectApiResponse>(
    `/api/v1/integrations/${source}/sync`,
    {
      method: "POST",
      fallback
    }
  );

  return {
    data: mapIntegrationConnect(result.data),
    source: result.source
  };
}

export async function completeStravaCallback(input: {
  code: string;
  state: string;
  scope?: string;
  callbackUrl?: string;
}): Promise<DataEnvelope<StravaCallbackData>> {
  const fallbackIntegration =
    integrationsFallback.find((integration) => integration.key === "strava") ?? integrationsFallback[0];
  const fallback: StravaCallbackApiResponse = {
    integration: {
      ...fallbackIntegration,
      connected: true,
      status: "oauth-code-received",
      runtime_summary: {
        token_ready: false,
        refresh_ready: false,
        token_exchange_ready: true,
        expires_at: null,
        athlete_name: null,
        athlete_id: null,
        last_token_refresh_at: null,
        synced_activity_count: 0
      }
    },
    token_exchange_ready: true,
    token_exchange_status: "authorization-code-captured",
    local_only_notice:
      "Atlas captured the callback in stub fallback mode. The packaged runtime should still exchange the token locally."
  };

  const result = await requestJson<StravaCallbackApiResponse>("/api/v1/integrations/strava/callback", {
    method: "POST",
    body: {
      code: input.code,
      state: input.state,
      scope: input.scope?.trim() ? input.scope : undefined,
      callback_url: input.callbackUrl?.trim() ? input.callbackUrl : undefined
    },
    fallback
  });

  return {
    data: mapStravaCallback(result.data),
    source: result.source
  };
}

export async function exchangeStravaTokens(): Promise<DataEnvelope<StravaTokenExchangeData>> {
  const fallbackIntegration =
    integrationsFallback.find((integration) => integration.key === "strava") ?? integrationsFallback[0];
  const fallback: StravaTokenExchangeApiResponse = {
    integration: {
      ...fallbackIntegration,
      connected: true,
      status: "token-ready",
      runtime_summary: {
        token_ready: true,
        refresh_ready: true,
        token_exchange_ready: false,
        expires_at: null,
        athlete_name: null,
        athlete_id: "stub-athlete",
        last_token_refresh_at: null,
        synced_activity_count: 0
      }
    },
    token_exchange_status: "token-ready",
    access_token_set: true,
    refresh_token_set: true,
    expires_at: null,
    athlete_id: "stub-athlete",
    local_only_notice:
      "Atlas completed a stub token exchange because the backend was unavailable."
  };

  const result = await requestJson<StravaTokenExchangeApiResponse>(
    "/api/v1/integrations/strava/token-exchange",
    {
      method: "POST",
      fallback
    }
  );

  return {
    data: mapStravaTokenExchange(result.data),
    source: result.source
  };
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const [featureRegistry, appPreferences, localization, profile, markets, ai] = await Promise.all([
    getFeatureRegistryData(),
    getAppPreferencesData(),
    getLocalizationSettingsData(),
    getProfileSettingsData(),
    getMarketOptionsData(),
    getAISettingsData()
  ]);

  return {
    featureRegistry,
    appPreferences,
    localization,
    profile,
    markets,
    ai
  };
}

export async function getOnboardingPageData(): Promise<OnboardingPageData> {
  const settingsData = await getSettingsPageData();
  const selectedMarket =
    settingsData.markets.data.find((market) => market.code === settingsData.localization.data.market) ??
    settingsData.markets.data[0];

  return {
    ...settingsData,
    selectedMarket
  };
}
