# Ollama On-Device Wiring and Agent Integration

Last updated: July 9, 2026

This document explains how Atlas keeps inference **on device** with Ollama by default, how the
optional Groq override works, and exactly how the local runtime connects to the three Atlas
agents (shared shell, endurance, nutrition). It is the reference for anyone touching the AI
runtime, provider clients, or agent orchestration.

---

## 1. Product requirement: nothing leaves the device by default

- **Ollama is the default provider** and runs fully on the user's device.
- Atlas **never** routes prompts through an Atlas-hosted service.
- **Groq is opt-in only.** When a user explicitly enables Groq and selects it, requests may leave
  the device **only to Groq directly** from the local runtime — never via an Atlas relay.
- Provider keys stay on the same device that runs Atlas and are **never returned to the UI** after
  save (`ollama_api_key_set` / `groq_api_key_set` booleans are exposed, not the keys).
- `local_only_mode` (default **true**) forces Ollama as default and forbids enabling Groq. See
  `SharedStateStore.update_ai_settings` in `apps/api/app/features/shared/services/state.py`.

The user-facing device notice lives in `apps/api/app/features/shared/services/ai.py`
(`DEVICE_NOTICE`) and is returned with AI settings.

---

## 2. Where the wiring lives

| Concern | File |
| --- | --- |
| AI settings model, prompt profiles, Ollama health check | `apps/api/app/features/shared/services/ai.py` |
| Provider clients (Ollama `/api/chat`, Groq) | `apps/api/app/features/shared/services/provider_clients.py` |
| Agent selection, grounding, execution plan, fallback | `apps/api/app/features/shared/services/agent_runtime.py` |
| Chat orchestration (provider selection + fallback) | `apps/api/app/features/shared/services/chat.py` |
| Settings + secret persistence | `apps/api/app/features/shared/services/state.py` |
| Defaults (base URL, models) | `apps/api/app/core/config.py` |
| Settings UI + runtime health check | `apps/web/components/ai-runtime-settings-form.tsx` |

Default config (`config.py`): base URL `http://localhost:11434`, chat model `llama3.1:8b`,
embed model `nomic-embed-text`, Groq model `llama-3.1-8b-instant`, `local_only_mode=True`.

---

## 3. Current request path (end to end)

1. UI saves AI runtime settings → `POST /api/v1/settings/ai`.
2. Backend persists settings locally (`state.py`); keys are stored separately from general state.
3. A chat request hits `POST /api/v1/chat` with `{feature, question, history}`.
4. `agent_runtime.build_execution_plan()`:
   - Picks the **prompt profile** for the feature (`find_prompt_profile`).
   - Builds **grounding** via `grounding_for_feature()` — deterministic, pre-computed summaries
     only (capability score, plan week, connector state, etc.).
   - Chooses the provider: `ai_settings.default_provider` (`ollama` unless Groq enabled+selected).
   - Trims history to `max_context_items`, assembles system + grounding + history + user messages.
5. `chat.py` selects `OllamaProviderClient` unless Groq is enabled and selected, then calls the
   provider. On any provider error it falls back to `agent_runtime.fallback_answer()`
   (deterministic, no model needed).
6. `provider_clients.py` calls the local Ollama `POST /api/chat` on the configured base URL.

### Health check

`ai.check_ollama_runtime()` calls `GET /api/version` and `GET /api/tags`, verifies the selected
model is installed, and classifies failures (service down, model missing, auth rejected,
timeout). It flags whether the target is loopback-local vs. an advanced remote URL
(`_normalize_ollama_base_url`).

---

## 4. Agent integration model

Three agents share one runtime. Their prompts are assembled in `ai.py`
(`build_prompt_profiles`) and their scope/grounding in `agent_runtime.py`.

```
                       POST /api/v1/chat  { feature }
                                 │
                    agent_runtime.build_execution_plan
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                         ▼
  shared profile          endurance profile          nutrition profile
  (shell agent)           (endurance agent)          (nutrition agent)
        │                        │                         │
  grounding_for_feature("shared" | "endurance" | "nutrition")
        │                        │                         │
        └────────────────────────┼────────────────────────┘
                                 ▼
                    provider (Ollama default / Groq opt-in)
                                 │
                     model reply  ──or──  deterministic fallback_answer
```

- **Shared shell agent** — owns shell, settings, runtime, connectors, guardrails. Grounding =
  active modules, routing mode, connected sources.
- **Endurance agent** — owns normalization, scoring, recovery, and (new) support links.
  Grounding = capability score, latest workout, timeline size, priority insight, connector state.
- **Nutrition agent** — owns planning, shopping, substitutions, cooking, and (new) refresh,
  calendar, meal-prep hacks, and video links. Grounding = plan week, projected spend, currency,
  cooking cadence, shopping items, batch day, primary substitution.

### Guardrails (enforced in prompts)

From `ai._guardrails`: use only provided structured signals, state uncertainty, no diagnosis /
triage / medication advice, be concise, prefer bullets + thresholds + next action. At the
`maximum` level: refuse to invent prices/biometrics, never leak secrets, never cross feature
boundaries without approved cross-feature context.

### Token discipline

Deterministic values are computed **before** the model runs and passed as compact grounding
lines. History is trimmed to `max_context_items`; `max_context_tokens` and
`response_token_budget` are passed to the provider. Prefer derived summaries over raw records.

---

## 5. Production wiring requirements (what is still missing)

These extend `prod-readiness-audit.md` section 4 with concrete tasks.

### 5.1 Loopback safety
- Bind Ollama access to loopback by default; treat non-local base URLs as **advanced mode** and
  warn the user in the settings UI (the backend already returns `local_target`).
- In packaged builds, never expose the runtime beyond `127.0.0.1`.

### 5.2 First-run runtime detection (onboarding wizard)
Detect, in order, and guide the user through each failure:
1. Is Ollama installed?
2. Is the daemon running?
3. Is the configured **chat** model available?
4. Is the configured **embedding** model available (only when retrieval features ship)?

### 5.3 Model bootstrap UX
- Suggest default models (`llama3.1:8b`, `nomic-embed-text`).
- Add a **pull-model** button that calls Ollama `POST /api/pull` and streams progress.
- Show download progress, disk usage, and cancel/retry.
- Validate the selected model on save; provide a clear fallback path when it is missing.
- Warn about device storage before large downloads.

### 5.4 Structured provider error handling
Cover: service down, model missing, timeout, connection refused, loopback blocked by firewall,
auth rejected. Each maps to a specific user message and a recovery action. The health check
already classifies most of these; surface them consistently in chat, not only in settings.

### 5.5 Local telemetry (privacy-preserving)
- Per-feature token + latency counters kept **on device only**. No health data leaves the device.
- Per-feature token/latency budgeting.

### 5.6 Packaging decision
Decide whether Atlas **requires** a separate Ollama install or **detects/assists** install on
first launch. Surface these links in-product:
- Download: `https://ollama.com/download`
- Model library: `https://ollama.com/library`
- API docs: `https://github.com/ollama/ollama/blob/main/docs/api.md`

### 5.7 Onboarding copy
Add explicit "nothing leaves this device" copy to onboarding, and clearly label the Groq path as
the only case where data leaves the device (directly to Groq).

---

## 6. Agent orchestration hardening (production)

Extends audit section 5. Introduce explicit agent **handoff contracts** rather than implicit
feature routing:

- **Structured request envelope**: user goal, active feature, approved cross-feature context,
  connector freshness timestamps, confidence level, response budget.
- **Structured output schema per agent** (typed, validated).
- **Response provenance**: `deterministic-only` | `deterministic + model wording` |
  `model-only suggestion`.
- **Guardrail test coverage** for unsafe medical / nutrition advice.
- **Prompt versioning** with a changelog, and **local prompt packs** so packaged builds ship
  stable prompts offline.

---

## 7. Quick verification

```bash
# Is the local daemon reachable and is the model present?
curl http://localhost:11434/api/version
curl http://localhost:11434/api/tags

# Atlas-side health check (drives the same logic as the settings UI):
curl http://localhost:8000/api/v1/settings/ai

# Feature-scoped chat (falls back deterministically if Ollama is down):
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"feature":"nutrition","question":"What should I prep first?","history":[]}'
```

If Ollama is not running, the chat endpoint still returns a coherent deterministic answer via
`fallback_answer` — this is by design so the app is useful before models are installed.
