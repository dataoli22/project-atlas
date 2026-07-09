# Ollama On-Device Wiring and Agent Integration

Last updated: July 9, 2026

This document explains Atlas's AI runtime posture — **cloud-first once configured, with automatic
on-device Ollama fallback** — how Groq and cloud-hosted Ollama work, how local-only mode still
provides a hard on-device guarantee for users who want it, and exactly how the runtime connects to
the three Atlas agents (shared shell, endurance, nutrition). It is the reference for anyone
touching the AI runtime, provider clients, or agent orchestration.

> **Posture change (July 9, 2026):** earlier revisions of this document described Ollama as the
> enforced default with Groq strictly opt-in. That has changed: Atlas now **prefers a cloud
> provider once one is configured** (Groq's free tier, or Ollama pointed at a cloud/hosted
> endpoint with an API key) for speed and capability, and **automatically falls back to on-device
> Ollama** if the cloud call fails. A fresh install with no keys configured still uses local
> Ollama by default (there is nothing else to use). `local_only_mode` remains available as an
> explicit opt-in for users who want a hard guarantee that inference never leaves the device.

---

## 1. Product requirement: keys and prompts never route through an Atlas-hosted relay

- Provider keys and prompts stay on this device and are sent **directly** from the device to
  whichever provider is configured — Atlas never relays them through an Atlas-owned server. This
  guarantee is unchanged by the cloud-first pivot; what changed is *which provider is preferred*,
  not *where the routing happens*.
- **Cloud providers are preferred by default once configured**: Groq (free tier) or Ollama pointed
  at a cloud/hosted endpoint with `ollama_api_key` set. With no keys configured, Atlas has nothing
  to prefer and uses local Ollama, which is why a zero-config install still works fully offline.
- **On-device Ollama is an automatic resilience fallback**: if the configured cloud provider call
  fails for any reason (auth rejected, timeout, service down, etc.), Atlas automatically retries
  against local Ollama (`http://localhost:11434`, same configured chat model) before falling back
  to a deterministic answer. See `chat.py`'s provider attempt chain in section 3.
- **`local_only_mode`** (default **false**) is the opt-in hard guarantee: when enabled, it forces
  Ollama as the only provider and blocks Groq entirely, so nothing can leave the device even if a
  cloud key is configured. See `SharedStateStore.update_ai_settings` in
  `apps/api/app/features/shared/services/state.py` — the validation rules there are unchanged,
  only the default value of `local_only_mode` flipped.
- Provider keys are **never returned to the UI** after save (`ollama_api_key_set` /
  `groq_api_key_set` booleans are exposed, not the keys).

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
embed model `nomic-embed-text`, Groq model `llama-3.1-8b-instant`, `local_only_mode=False`.

---

## 3. Current request path (end to end)

1. UI saves AI runtime settings → `POST /api/v1/settings/ai`.
2. Backend persists settings via SQLite (`state.py`); keys go through the OS-native secret
   storage abstraction (`secure_storage.py`), stored separately from general state.
3. A chat request hits `POST /api/v1/chat` with `{feature, question, history}`.
4. `agent_runtime.build_execution_plan()`:
   - Picks the **prompt profile** for the feature (`find_prompt_profile`).
   - Builds **grounding** via `grounding_for_feature()` — deterministic, pre-computed summaries
     only (capability score, plan week, connector state, etc.).
   - Resolves the *primary* provider from `ai_settings.default_provider` (`ollama` or `groq`) and
     `ai_settings.ollama_base_url` (local or cloud).
   - Trims history to `max_context_items`, assembles system + grounding + history + user messages.
5. `chat.py` builds an **ordered provider attempt chain** via `_build_provider_attempts()`:
   - **Primary**: the configured provider (Groq, or Ollama at whatever `ollama_base_url` points
     to — local or cloud).
   - **Fallback** (only added when the primary is *not* already local Ollama): on-device Ollama at
     `http://localhost:11434` using the same configured chat model, with no API key.
   - Each attempt is tried in order; on failure the error is classified
     (`_classify_provider_error`) and recorded as a warning, and the chain moves to the next
     attempt.
   - If every attempt in the chain fails, `chat.py` falls back to
     `agent_runtime.fallback_answer()` (deterministic, no model needed), and the response's
     `provider_error_kind` reflects the *last* classified failure.
6. `provider_clients.py` calls the resolved provider's chat endpoint (`OllamaProviderClient` uses
   a 120s timeout — local, CPU/GPU-bound generation can genuinely take that long on modest
   hardware; `GroqProviderClient` uses the OpenAI-compatible `/chat/completions` shape).

### Structured provider errors

`ChatResponse.provider_error_kind` is one of `service_down | model_missing | timeout |
connection_refused | auth_rejected | other`, set whenever the final response falls back to the
deterministic stub. The Ask Atlas UI (`ask-atlas-form.tsx`) surfaces this as a distinct labeled
panel with plain-language remediation text, not just a free-text warning string.

### Health check

`ai.check_ollama_runtime()` calls `GET /api/version` and `GET /api/tags`, verifies the selected
**chat and embedding** models are both installed (tag-normalized — see below), and classifies
failures (service down, model missing, auth rejected, timeout). It flags whether the target is
loopback-local vs. an advanced remote/cloud URL (`_normalize_ollama_base_url`), and — for local
targets only — whether the `ollama` binary is present on PATH (`_is_ollama_binary_present`,
distinguishing "not installed" from "installed but not running").

Model-tag matching is normalized: Ollama's `/api/tags` always returns fully-qualified names
(`nomic-embed-text:latest`), but configured model names are often left bare. `_normalize_model_tag`
appends `:latest` to bare names before comparing, otherwise a genuinely installed model is falsely
reported as missing — this was found and fixed by testing against a real local Ollama instance.

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
                  primary provider (Groq or Ollama, local or cloud)
                                 │ on failure
                  on-device Ollama fallback (skipped if primary was already local)
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

## 5. Production wiring requirements

Status as of this iteration:

### 5.1 Loopback safety — DONE
- The settings UI (`ai-runtime-settings-form.tsx`) shows a visible warning banner
  (`isLocalBaseUrl()`) whenever the configured base URL is not a loopback address, labeling it
  "Advanced: non-local Ollama target."
- [ ] Still missing: in packaged builds, enforce that the sidecar itself never binds beyond
  `127.0.0.1` (this is about Atlas's own backend port, not the Ollama target URL).

### 5.2 First-run runtime detection — DONE
`check_ollama_runtime()` now reports all four states, surfaced in the settings UI as a numbered
checklist ("1. Installed", "2. Running", "3. Chat model", "4. Embedding model"), each with
remediation copy (download link, pull button, etc.):
1. Is Ollama installed? (`installed` field, PATH-detected for local targets; `None` for
   non-local/cloud targets since Atlas cannot detect a remote install)
2. Is the daemon running? (connection reachability)
3. Is the configured **chat** model available? (tag-normalized match)
4. Is the configured **embedding** model available? (tag-normalized match)

### 5.3 Model bootstrap UX — PARTIALLY DONE
- [x] Pull-model button (`POST /api/v1/settings/ai/pull` → `ai.pull_ollama_model`) appears next to
  each check that reports a missing model.
- [x] Clear fallback path when a model is missing (chat automatically retries local Ollama with
  whatever model *is* configured; the health check tells the user exactly what to pull).
- [ ] **Not implemented**: live streaming download progress. The pull endpoint uses Ollama's
  `stream: false` mode — a real, functional pull with a clear success/failure result, but no
  percentage progress bar. Live progress needs an NDJSON streaming proxy through FastAPI and a
  streaming reader on the frontend; deliberately deferred as a larger, separate lift.
- [ ] Disk usage display and cancel/retry are not implemented.

### 5.4 Structured provider error handling — DONE
`ChatResponse.provider_error_kind` covers service_down, model_missing, timeout,
connection_refused, auth_rejected, other — classified in `chat._classify_provider_error` from the
real exception type/HTTP status, and displayed as a distinct panel in the Ask Atlas UI (not just a
free-text warning). Verified against a real Ollama instance for `model_missing` (404) and
`connection_refused` (bad port), and against a live chat call for `auth_rejected` (invalid Groq
key) and `timeout` (local generation exceeding the client timeout on modest hardware).

### 5.5 Local telemetry (privacy-preserving) — NOT STARTED
- [ ] Per-feature token + latency counters kept on device only.
- [ ] Per-feature token/latency budgeting.

### 5.6 Packaging decision — NOT DECIDED
Still need to decide whether Atlas **requires** a separate Ollama install or **detects/assists**
install on first launch for the packaged desktop/Android builds. In-product links already
surfaced via `ai.OLLAMA_DOWNLOAD_URL` / `OLLAMA_LIBRARY_URL` / `OLLAMA_API_DOCS_URL`:
- Download: `https://ollama.com/download`
- Model library: `https://ollama.com/library`
- API docs: `https://github.com/ollama/ollama/blob/main/docs/api.md`

### 5.7 Onboarding copy — DONE
The onboarding page has a "Where your data goes" section explaining the cloud-first-with-local-
fallback posture, that keys/prompts never route through an Atlas-hosted relay, and that
`local_only_mode` is available for a hard on-device guarantee.

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

# Atlas-side first-run check (drives the same logic as the settings UI wizard):
curl -X POST http://localhost:8000/api/v1/settings/ai/health \
  -H "Content-Type: application/json" \
  -d '{"ollama_base_url":"http://localhost:11434","ollama_model":"llama3.1:8b","ollama_embed_model":"nomic-embed-text"}'

# Pull a model (blocking, non-streaming - returns a final success/failure result):
curl -X POST http://localhost:8000/api/v1/settings/ai/pull \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:8b","ollama_base_url":"http://localhost:11434"}'

# Feature-scoped chat (tries the configured provider, then on-device Ollama, then a
# deterministic fallback - see the provider attempt chain in section 3):
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"feature":"nutrition","question":"What should I prep first?","history":[]}'
```

If nothing is reachable, the chat endpoint still returns a coherent deterministic answer via
`fallback_answer` — this is by design so the app is useful before any provider is configured.
Check the response's `provider_error_kind` and `warnings` to see exactly which attempts were
tried and why each failed.

### Verified against a real local Ollama instance (July 9, 2026)

This section's behavior was validated live, not just unit-tested, against a machine with Ollama
0.31.1 running `qwen2.5:7b` and `nomic-embed-text` installed (the configured default chat model,
`llama3.1:8b`, was *not* installed — a realistic first-run scenario):

- Health check correctly reported the configured chat model as missing while confirming the
  embedding model was installed (this is what caught and fixed the `_normalize_model_tag` bug —
  see section 3).
- Health check correctly reported `ok: true` once pointed at models that were genuinely installed.
- The pull endpoint correctly confirmed an already-installed model instantly and correctly
  surfaced Ollama's real error message for a nonexistent model.
- A live chat request with Groq configured as primary (using a deliberately invalid key) correctly
  classified the failure as `auth_rejected`, then automatically retried local Ollama, which in one
  run succeeded and in another exceeded the 120s client timeout (`timeout`) on this hardware —
  both are the intended, honest behavior of the fallback chain, not bugs.
