"use client";

import { useState, useTransition } from "react";

import type { ApiDataSource } from "@/lib/api";
import type { AISettingsData, AIRuntimeHealthCheckData } from "@/lib/settings-data";
import { saveAISettings, testAIRuntimeHealth } from "@/lib/settings-data";

type AIRuntimeSettingsFormProps = {
  initialSettings: AISettingsData;
  initialSource: ApiDataSource;
};

export function AIRuntimeSettingsForm({
  initialSettings,
  initialSource
}: AIRuntimeSettingsFormProps) {
  const [settings, setSettings] = useState<AISettingsData>(initialSettings);
  const [ollamaApiKey, setOllamaApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [clearOllamaApiKey, setClearOllamaApiKey] = useState(false);
  const [clearGroqApiKey, setClearGroqApiKey] = useState(false);
  const [lastSource, setLastSource] = useState<ApiDataSource>(initialSource);
  const [status, setStatus] = useState("AI runtime settings are ready to save.");
  const [healthStatus, setHealthStatus] = useState<AIRuntimeHealthCheckData | null>(null);
  const [healthSource, setHealthSource] = useState<ApiDataSource | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();

  function updateLocalOnlyMode(nextValue: boolean) {
    setSettings((current) => ({
      ...current,
      localOnlyMode: nextValue,
      defaultProvider: nextValue ? "ollama" : current.defaultProvider,
      allowGroq: nextValue ? false : current.allowGroq
    }));
  }

  function saveRuntimeSettings() {
    startSaveTransition(async () => {
      const result = await saveAISettings({
        ...settings,
        ollamaApiKey,
        groqApiKey,
        clearOllamaApiKey,
        clearGroqApiKey
      });

      setSettings(result.data);
      setOllamaApiKey("");
      setGroqApiKey("");
      setClearOllamaApiKey(false);
      setClearGroqApiKey(false);
      setLastSource(result.source);
      setStatus(
        result.source === "api"
          ? "Saved to the local Atlas runtime on this device."
          : "Backend unavailable, so the page stayed in stub fallback mode."
      );
    });
  }

  function runOllamaHealthCheck() {
    startTestTransition(async () => {
      const result = await testAIRuntimeHealth({
        ollamaBaseUrl: settings.ollamaBaseUrl,
        ollamaModel: settings.ollamaModel,
        ollamaApiKey
      });

      setHealthStatus(result.data);
      setHealthSource(result.source);
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">On-device AI runtime</div>
      <p className="atlas-note">{settings.deviceNotice}</p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Default provider</span>
          <select
            value={settings.defaultProvider}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                defaultProvider: event.target.value as AISettingsData["defaultProvider"]
              }))
            }
            disabled={settings.localOnlyMode}
          >
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
          </select>
        </label>

        <label className="atlas-form-field">
          <span>Prompt profile</span>
          <select
            value={settings.systemPromptStyle}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                systemPromptStyle: event.target.value as AISettingsData["systemPromptStyle"]
              }))
            }
          >
            <option value="token-lean">Token lean</option>
            <option value="comprehensive-guarded">Comprehensive guarded</option>
          </select>
        </label>

        <label className="atlas-form-field">
          <span>Guardrail level</span>
          <select
            value={settings.guardrailLevel}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                guardrailLevel: event.target.value as AISettingsData["guardrailLevel"]
              }))
            }
          >
            <option value="strict">Strict</option>
            <option value="maximum">Maximum</option>
          </select>
        </label>

        <label className="atlas-form-field">
          <span>Max context items</span>
          <input
            type="number"
            min="1"
            max="24"
            value={settings.maxContextItems}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                maxContextItems: Number(event.target.value)
              }))
            }
          />
        </label>

        <label className="atlas-form-field">
          <span>Max context tokens</span>
          <input
            type="number"
            min="256"
            max="8192"
            step="64"
            value={settings.maxContextTokens}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                maxContextTokens: Number(event.target.value)
              }))
            }
          />
        </label>

        <label className="atlas-form-field">
          <span>Response token budget</span>
          <input
            type="number"
            min="64"
            max="2048"
            step="32"
            value={settings.responseTokenBudget}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                responseTokenBudget: Number(event.target.value)
              }))
            }
          />
        </label>
      </div>

      <div className="atlas-stack">
        <label className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Local-only mode</div>
            <div className="atlas-control-card__meta">Force Ollama as the active provider and block remote AI use.</div>
          </div>
          <div className="atlas-control-card__actions">
            <input
              type="checkbox"
              checked={settings.localOnlyMode}
              onChange={(event) => updateLocalOnlyMode(event.target.checked)}
            />
          </div>
        </label>

        <label className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Self-hosted distribution</div>
            <div className="atlas-control-card__meta">Treat Atlas as a packaged local app instead of a centralized hosted service.</div>
          </div>
          <div className="atlas-control-card__actions">
            <input
              type="checkbox"
              checked={settings.selfHostedDistribution}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  selfHostedDistribution: event.target.checked
                }))
              }
            />
          </div>
        </label>

        <label className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Allow Groq</div>
            <div className="atlas-control-card__meta">Optional remote provider fallback. Leave off for fully on-device AI.</div>
          </div>
          <div className="atlas-control-card__actions">
            <input
              type="checkbox"
              checked={settings.allowGroq}
              disabled={settings.localOnlyMode}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  allowGroq: event.target.checked,
                  defaultProvider: event.target.checked ? current.defaultProvider : "ollama"
                }))
              }
            />
          </div>
        </label>
      </div>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Ollama base URL</span>
          <input
            type="text"
            value={settings.ollamaBaseUrl}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                ollamaBaseUrl: event.target.value
              }))
            }
          />
        </label>

        <label className="atlas-form-field">
          <span>Ollama generation model</span>
          <input
            type="text"
            value={settings.ollamaModel}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                ollamaModel: event.target.value
              }))
            }
          />
        </label>

        <label className="atlas-form-field">
          <span>Ollama embedding model</span>
          <input
            type="text"
            value={settings.ollamaEmbedModel}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                ollamaEmbedModel: event.target.value
              }))
            }
          />
        </label>

        <label className="atlas-form-field">
          <span>Ollama API key</span>
          <input type="password" value={ollamaApiKey} onChange={(event) => setOllamaApiKey(event.target.value)} />
        </label>

        <label className="atlas-form-field">
          <span>Groq model</span>
          <input
            type="text"
            value={settings.groqModel}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                groqModel: event.target.value
              }))
            }
            disabled={!settings.allowGroq}
          />
        </label>

        <label className="atlas-form-field">
          <span>Groq API key</span>
          <input
            type="password"
            value={groqApiKey}
            onChange={(event) => setGroqApiKey(event.target.value)}
            disabled={!settings.allowGroq}
          />
        </label>
      </div>

      <div className="atlas-detail-list">
        <div className="atlas-detail-list__row">
          <dt>Ollama key stored</dt>
          <dd>{settings.ollamaApiKeySet ? "Yes" : "No"}</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Groq key stored</dt>
          <dd>{settings.groqApiKeySet ? "Yes" : "No"}</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Last save source</dt>
          <dd>{lastSource === "api" ? "Local API" : "Stub fallback"}</dd>
        </div>
        <div className="atlas-detail-list__row">
          <dt>Last runtime test</dt>
          <dd>
            {healthStatus
              ? `${healthStatus.ok ? "Reachable" : "Needs attention"}${healthSource === "stub" ? " (fallback)" : ""}`
              : "Not run yet"}
          </dd>
        </div>
      </div>

      <div className="atlas-stack">
        <label className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Clear stored Ollama key</div>
            <div className="atlas-control-card__meta">Use this if you want to remove the current local runtime secret.</div>
          </div>
          <div className="atlas-control-card__actions">
            <input type="checkbox" checked={clearOllamaApiKey} onChange={(event) => setClearOllamaApiKey(event.target.checked)} />
          </div>
        </label>

        <label className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Clear stored Groq key</div>
            <div className="atlas-control-card__meta">Useful when returning the app to fully local Ollama-only mode.</div>
          </div>
          <div className="atlas-control-card__actions">
            <input type="checkbox" checked={clearGroqApiKey} onChange={(event) => setClearGroqApiKey(event.target.checked)} />
          </div>
        </label>
      </div>

      <p className="atlas-note">{status}</p>
      <div className="atlas-stack">
        <div className="atlas-control-card">
          <div className="atlas-control-card__content">
            <div className="atlas-control-card__title">Ollama runtime check</div>
            <div className="atlas-control-card__meta">
              Test whether Atlas can reach the configured Ollama runtime on this device before saving. Keys are never shown back in the result.
            </div>
            {healthStatus ? (
              <div className="atlas-stack">
                <div className="atlas-note">{healthStatus.message}</div>
                <div className="atlas-detail-list">
                  <div className="atlas-detail-list__row">
                    <dt>Target</dt>
                    <dd>{healthStatus.target}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Runtime location</dt>
                    <dd>{healthStatus.localTarget ? "Local device" : "Non-local target"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Ollama version</dt>
                    <dd>{healthStatus.version ?? "Unavailable"}</dd>
                  </div>
                  <div className="atlas-detail-list__row">
                    <dt>Selected model</dt>
                    <dd>
                      {healthStatus.modelChecked
                        ? healthStatus.modelAvailable === false
                          ? `${healthStatus.modelChecked} (not installed)`
                          : healthStatus.modelChecked
                        : "Not checked"}
                    </dd>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="atlas-control-card__actions">
            <button
              type="button"
              className="atlas-button"
              onClick={runOllamaHealthCheck}
              disabled={isTesting}
            >
              {isTesting ? "Testing..." : "Test Ollama connection"}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="atlas-button atlas-button--primary"
        onClick={saveRuntimeSettings}
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : "Save AI runtime settings"}
      </button>
    </section>
  );
}
