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

export type ChatResponseData = {
  feature: ChatFeatureScope;
  provider: "ollama" | "groq" | "stub";
  model: string;
  answer: string;
  warnings: string[];
  tokenStrategyNote: string;
  appliedPromptTitle: string;
  grounding: ChatGroundingItem[];
  providerErrorKind: ProviderErrorKind | null;
};

type ChatApiResponse = {
  feature: ChatFeatureScope;
  provider: "ollama" | "groq" | "stub";
  model: string;
  answer: string;
  warnings: string[];
  token_strategy_note: string;
  applied_prompt_title: string;
  grounding: ChatGroundingItem[];
  provider_error_kind: ProviderErrorKind | null;
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
    grounding: response.grounding,
    providerErrorKind: response.provider_error_kind ?? null
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
    grounding: [],
    provider_error_kind: "service_down"
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
