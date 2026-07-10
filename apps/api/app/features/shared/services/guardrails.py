from __future__ import annotations

import re

# Deterministic, regex-based post-generation checks. Local models vary widely in whether they
# honor system-prompt instructions, so the system prompt guardrails in `ai.py` are necessary but
# not sufficient - this is the enforcement backstop that runs on every answer regardless of which
# provider produced it, including the deterministic stub path. Findings are advisory: per product
# decision (matches the endurance medical-escalation feature), Atlas never blocks a response, it
# surfaces the finding as a warning so the user can judge the answer with that context.
_GUARDRAIL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "Answer may state or imply a medical diagnosis.",
        re.compile(
            r"\byou (have|are suffering from|are experiencing) (a |an )?"
            r"[a-z][a-z \-]{2,40}(disease|disorder|syndrome|condition|deficiency|infection)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Answer may state or imply a medical diagnosis.",
        re.compile(r"\b(diagnos(e|is|ed|ing))\b", re.IGNORECASE),
    ),
    (
        "Answer may include medication or dosing guidance.",
        re.compile(
            r"\b(take|prescribe|dose|dosage)\b.{0,25}\b(\d+\s?(mg|mcg|g|ml|iu)|"
            r"ibuprofen|acetaminophen|tylenol|advil|aspirin|antibiotic|insulin)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Answer may discourage seeking medical care.",
        re.compile(
            r"\b(no need to|don't|do not|you don't have to)\b.{0,20}"
            r"\b(see a doctor|see a physician|seek (medical )?(care|attention|help))\b",
            re.IGNORECASE,
        ),
    ),
]


def check_guardrails(answer: str) -> list[str]:
    """Scan a generated answer for disallowed content categories.

    Returns a list of human-readable finding descriptions (empty when clean). Deduplicates by
    finding description so a pattern that matches multiple times in one answer surfaces once.
    """

    findings: list[str] = []
    for description, pattern in _GUARDRAIL_PATTERNS:
        if description in findings:
            continue
        if pattern.search(answer):
            findings.append(description)

    return findings
