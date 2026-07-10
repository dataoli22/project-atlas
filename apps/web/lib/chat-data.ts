import { requestJson } from "@/lib/api";

export type ChatFeatureScope = "shared" | "endurance" | "nutrition";

export type ChatGroundingItem = {
  label: string;
  value: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderErrorKind =
  | "service_down"
  | "model_missing"
  | "timeout"
  | "connection_refused"
  | "auth_rejected"
  | "other";

export type ResponseProvenance = "deterministic-only" | "model-with-grounding" | "model-only";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ChatResponseData = {
  feature: ChatFeatureScope;
  provider: "ollama" | "groq" | "stub";
  model: string;
  answer: string;
  warnings: string[];
  tokenStrategyNote: string;
  appliedPromptTitle: string;
  promptVersion: string;
  grounding: ChatGroundingItem[];
  providerErrorKind: ProviderErrorKind | null;
  responseProvenance: ResponseProvenance;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  connectorFreshness: string;
  guardrailPassed: boolean;
  guardrailFindings: string[];
};

type ChatApiResponse = {
  feature: ChatFeatureScope;
  provider: "ollama" | "groq" | "stub";
  model: string;
  answer: string;
  warnings: string[];
  token_strategy_note: string;
  applied_prompt_title: string;
  prompt_version: string;
  grounding: ChatGroundingItem[];
  provider_error_kind: ProviderErrorKind | null;
  response_provenance: ResponseProvenance;
  confidence: ConfidenceLevel;
  confidence_reason: string;
  connector_freshness: string;
  guardrail_passed: boolean;
  guardrail_findings: string[];
};

function mapChatResponse(response: ChatApiResponse): ChatResponseData {
  return {
    feature: response.feature,
    provider: response.provider,
    model: response.model,
    answer: response.answer,
    warnings: response.warnings,
    tokenStrategyNote: response.token_strategy_note,
    appliedPromptTitle: response.applied_prompt_title,
    promptVersion: response.prompt_version,
    grounding: response.grounding,
    providerErrorKind: response.provider_error_kind ?? null,
    responseProvenance: response.response_provenance,
    confidence: response.confidence,
    confidenceReason: response.confidence_reason,
    connectorFreshness: response.connector_freshness,
    guardrailPassed: response.guardrail_passed,
    guardrailFindings: response.guardrail_findings
  };
}

export async function askAtlas(input: {
  feature: ChatFeatureScope;
  question: string;
  history: ChatMessage[];
}) {
  const fallback: ChatApiResponse = {
    feature: input.feature,
    provider: "stub",
    model: "local-fallback",
    answer:
      "Atlas is currently using the local fallback path. Start from the visible structured metrics and try again once the local runtime is available.",
    warnings: ["The local API was unavailable, so the request stayed in fallback mode."],
    token_strategy_note: "Keep only the most relevant recent turns and structured signals in context.",
    applied_prompt_title: "Fallback prompt",
    prompt_version: "n/a",
    grounding: [],
    provider_error_kind: "service_down",
    response_provenance: "deterministic-only",
    confidence: "low",
    confidence_reason: "The local API was unreachable, so no connector state could be checked.",
    connector_freshness: "Unknown - local API unreachable.",
    guardrail_passed: true,
    guardrail_findings: []
  };

  const result = await requestJson<ChatApiResponse>("/api/v1/chat", {
    method: "POST",
    body: {
      feature: input.feature,
      question: input.question,
      history: input.history
    },
    fallback
  });

  return {
    data: mapChatResponse(result.data),
    source: result.source
  };
}
