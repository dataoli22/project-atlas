# Prompt changelog

Atlas's agent prompts are authored in `apps/api/app/features/shared/services/ai.py`
(`_shared_prompt`, `_endurance_prompt`, `_nutrition_prompt`, `_guardrails`) and shipped inside
the packaged sidecar exe — there is no runtime prompt fetch, so every packaged build is fully
usable offline and the prompt version stamped on each `ChatResponse` (`prompt_version` field) is
the audit trail for "what prompt actually produced this answer."

Bump `PROMPT_VERSION` in `ai.py` whenever a prompt's wording, guardrail rules, or role
instructions change materially, and add an entry here in the same commit.

## 2026.07-1 — Agent orchestration backlog (initial versioning)

- First versioned prompt release. No wording changes from the prior unversioned prompts — this
  entry exists to establish the changelog convention itself.
- Added deterministic post-generation guardrail checks (`guardrails.py`) that run on every answer
  regardless of provider, catching diagnosis-like language, medication/dosing language, and
  "don't see a doctor" language that a local model might produce even when the system prompt
  instructs otherwise. Findings are advisory (surfaced as `guardrail_findings`), never blocking.
- Added `confidence` / `confidence_reason` / `connector_freshness` to the execution plan and
  `ChatResponse`, computed from real connector sync state (Strava activity count, pantry items,
  Health Connect / Samsung Health session counts) rather than assumed.
- Added `response_provenance` (`deterministic-only` / `model-with-grounding` / `model-only`) so
  a caller can tell whether an answer came from the local fallback, a model reasoning over real
  grounding, or a model with no grounding at all.
