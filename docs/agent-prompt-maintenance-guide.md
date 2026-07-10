# Agent prompt / version maintenance guide

This is a maintainer guide (not end-user facing) for changing Atlas's agent prompts and
guardrails - the shared shell, endurance coach, and nutrition planner agents that back the chat
feature.

## Where prompts live

All prompt text is authored directly in
`apps/api/app/features/shared/services/ai.py`:

- `_shared_prompt(style)`, `_endurance_prompt(style)`, `_nutrition_prompt(style)` - the three
  agent system prompts, each with a `token-lean` and `comprehensive-guarded` variant
  (`PromptStyle`, user-selectable in Settings).
- `_guardrails(level)` - the guardrail rules appended to every prompt, with an extended rule set
  at `guardrail_level="maximum"`.
- `build_prompt_profiles(...)` - assembles all three into `AgentPromptProfile` objects, stamping
  every one with the current `PROMPT_VERSION` constant.

There is no runtime prompt fetch - prompts are Python code, compiled into the FastAPI backend and
shipped inside the packaged PyInstaller sidecar exe. A packaged build is fully offline; changing a
prompt requires a new release, not a config push.

## Deterministic guardrails vs. prompt guardrails

Prompt-level guardrail rules (`_guardrails()`) are instructions to the model - necessary, but not
sufficient, since local models vary in how reliably they follow system prompts. The real
enforcement backstop is `apps/api/app/features/shared/services/guardrails.py`'s
`check_guardrails()`, a deterministic regex scan that runs on every chat answer regardless of
provider (including the stub fallback), catching diagnosis language, medication/dosing language,
and "don't see a doctor" language. Findings are advisory only (`guardrail_passed`/
`guardrail_findings` on `ChatResponse`) - Atlas never blocks a response, per the same product
decision behind the endurance medical-escalation feature
(`apps/api/app/features/endurance/medical_escalation.py`).

If you need to catch a new unsafe-content category, add a pattern to
`_GUARDRAIL_PATTERNS` in `guardrails.py`, not to the prompt text - the prompt asks the model to
avoid it, the regex catches it if the model doesn't listen.

## Bumping the prompt version

1. Edit the prompt text, guardrail rules, or role instructions in `ai.py`.
2. Bump `PROMPT_VERSION` (format: `YYYY.MM-n`, e.g. `2026.07-1` → `2026.07-2` for a same-month
   follow-up, or `2026.08-1` for the next month's first change).
3. Add an entry to `docs/prompt-changelog.md` under the new version, describing what changed and
   why. This is the only audit trail for "what prompt produced this answer" - every `ChatResponse`
   returns the `prompt_version` it was generated under, and the web chat UI
   (`apps/web/components/ask-atlas-form.tsx`) displays it next to the answer.
4. Run the backend test suite - `test_agent_handoff_contract.py` and `test_ai_settings.py` assert
   every prompt profile carries a non-empty, consistent `prompt_version`; add a regression test if
   the change affects guardrail behavior (see `test_guardrail_checks.py` and
   `test_chat_response_metadata.py` for the existing pattern of asserting on real answer text, not
   mocked model output).
5. If the change affects what's safe to say about medical topics specifically, treat it with the
   same review bar as `medical_escalation.py`'s copy - conservative, cite the specific triggering
   signal, never diagnose, always frame as "mention this to a doctor."

## What NOT to do

- Don't add a new provider-facing prompt variant without updating `PromptStyle`'s Literal type in
  `apps/api/app/features/shared/schemas/app.py` and its Settings UI options.
- Don't skip the changelog entry - a `prompt_version` bump with no changelog entry breaks the
  entire point of versioning it.
- Don't rely on the model to enforce a new guardrail category - add it to `guardrails.py`'s
  deterministic checks as well.
