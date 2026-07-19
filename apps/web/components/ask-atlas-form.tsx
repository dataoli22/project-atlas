"use client";

import { useState, useTransition } from "react";

import { HintTooltip } from "@/components/hint-tooltip";
import type { ApiDataSource } from "@/lib/api";
import {
  askAtlas,
  type ChatFeatureScope,
  type ChatMessage,
  type ChatResponseData,
  type ProviderErrorKind
} from "@/lib/chat-data";

type AskAtlasFormProps = {
  initialFeature: ChatFeatureScope;
  /** Hides the "Grounding panel" (provider/model/citation detail) column - used when this form is
   * embedded inline on another page (e.g. the dashboard) where that level of debug detail would
   * compete with the page's own primary content. The full chat at /ask still shows it. */
  hideGroundingPanel?: boolean;
};

const PROVIDER_ERROR_COPY: Record<ProviderErrorKind, string> = {
  service_down: "The provider responded with an error. Check the runtime and try again.",
  model_missing: "The selected model is not installed on the runtime. Pull it in AI runtime settings.",
  timeout: "The provider took too long to respond. Local models can be slow on modest hardware - try again.",
  connection_refused: "Atlas could not reach the provider. Make sure it is running and reachable.",
  auth_rejected: "The provider rejected the credentials. Check the stored API key in AI runtime settings.",
  other: "The provider was unavailable for an unclassified reason."
};

export function AskAtlasForm({ initialFeature, hideGroundingPanel = false }: AskAtlasFormProps) {
  const [feature, setFeature] = useState<ChatFeatureScope>(initialFeature);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<ChatResponseData | null>(null);
  const [source, setSource] = useState<ApiDataSource>("stub");
  const [status, setStatus] = useState("Ask a scoped question grounded in the Atlas data already visible in this app.");
  const [isPending, startTransition] = useTransition();

  function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed) {
      setStatus("Enter a question before sending it to Atlas.");
      return;
    }

    startTransition(async () => {
      const nextHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];
      const response = await askAtlas({
        feature,
        question: trimmed,
        history
      });

      setHistory([...nextHistory, { role: "assistant", content: response.data.answer }]);
      setResult(response.data);
      setSource(response.source);
      setQuestion("");
      setStatus(
        response.source === "api"
          ? `Answered through the local ${response.data.provider} runtime.`
          : "Local API unavailable, so Atlas used the frontend fallback."
      );
    });
  }

  return (
    <div className={hideGroundingPanel ? "atlas-stack" : "atlas-grid atlas-grid--hero"}>
      <section className="atlas-panel atlas-stack">
        <div className="atlas-panel__eyebrow">Conversation frame</div>
        <div className="atlas-form-grid">
          <label className="atlas-form-field">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              Feature scope
              <HintTooltip label="What scope changes">
                Which data Atlas looks at to answer - Endurance for training, Nutrition for meals,
                or Shared for general questions across both.
              </HintTooltip>
            </span>
            <select value={feature} onChange={(event) => setFeature(event.target.value as ChatFeatureScope)}>
              <option value="shared">Shared shell</option>
              <option value="endurance">Endurance</option>
              <option value="nutrition">Nutrition</option>
            </select>
          </label>
        </div>

        <label className="atlas-form-field">
          <span>Question</span>
          <textarea
            className="atlas-textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What should I pay attention to next week based on my current training or meal plan?"
            rows={5}
          />
        </label>

        <div className="atlas-control-card__actions">
          <button
            type="button"
            className="atlas-button atlas-button--primary"
            onClick={submitQuestion}
            disabled={isPending}
          >
            {isPending ? "Thinking..." : "Ask Atlas"}
          </button>
        </div>

        <p className="atlas-note">{status}</p>

        <div className="atlas-stack">
          {history.slice(-6).map((item, index) => (
            <div key={`${item.role}-${index}`} className="atlas-list-card">
              <div className="atlas-list-card__title">{item.role === "user" ? "You" : "Atlas"}</div>
              <div className="atlas-list-card__meta">{item.content}</div>
            </div>
          ))}
        </div>
      </section>

      {hideGroundingPanel ? null : (
      <section className="atlas-panel atlas-stack">
        <div
          className="atlas-panel__eyebrow"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          How this answer was built
          <HintTooltip label="What these terms mean">
            Provider/model = which AI answered. Response provenance = whether it used your real
            data, a canned fallback, or both. Confidence = how sure Atlas is. Connector freshness
            = how recently your connected apps synced.
          </HintTooltip>
        </div>
        {result ? (
          <>
            <dl className="atlas-detail-list">
              <div className="atlas-detail-list__row">
                <dt>Provider</dt>
                <dd>{result.provider}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Model</dt>
                <dd>{result.model}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Prompt profile</dt>
                <dd>{result.appliedPromptTitle} (v{result.promptVersion})</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Save path</dt>
                <dd>{source === "api" ? "Local API" : "Stub fallback"}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Response provenance</dt>
                <dd>{result.responseProvenance.replace(/-/g, " ")}</dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Confidence</dt>
                <dd>
                  {result.confidence} - {result.confidenceReason}
                </dd>
              </div>
              <div className="atlas-detail-list__row">
                <dt>Connector freshness</dt>
                <dd>{result.connectorFreshness}</dd>
              </div>
            </dl>

            <div className="atlas-list-card">
              <div className="atlas-list-card__title">Answer</div>
              <div className="atlas-list-card__meta">{result.answer}</div>
            </div>

            <div className="atlas-list-card">
              <div className="atlas-list-card__title">Token strategy</div>
              <div className="atlas-list-card__meta">{result.tokenStrategyNote}</div>
            </div>

            <dl className="atlas-detail-list">
              {result.grounding.map((item) => (
                <div key={item.label} className="atlas-detail-list__row">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>

            {!result.guardrailPassed ? (
              <div className="atlas-list-card" style={{ borderColor: "var(--atlas-warm)" }}>
                <div className="atlas-list-card__title">Flagged for review</div>
                <div className="atlas-list-card__meta">
                  {result.guardrailFindings.join(" ")}
                </div>
              </div>
            ) : null}

            {result.providerErrorKind ? (
              <div className="atlas-list-card" style={{ borderColor: "var(--atlas-warm)" }}>
                <div className="atlas-list-card__title">Provider issue: {result.providerErrorKind.replace(/_/g, " ")}</div>
                <div className="atlas-list-card__meta">{PROVIDER_ERROR_COPY[result.providerErrorKind]}</div>
              </div>
            ) : null}

            {result.warnings.length > 0 ? (
              <div className="atlas-stack">
                {result.warnings.map((warning) => (
                  <div key={warning} className="atlas-list-card">
                    <div className="atlas-list-card__title">Warning</div>
                    <div className="atlas-list-card__meta">{warning}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="atlas-placeholder">
            Atlas will show grounded feature context, chosen prompt profile, token strategy, and any local-runtime fallback warnings here.
          </div>
        )}
      </section>
      )}
    </div>
  );
}
