from app.features.shared.services.guardrails import check_guardrails


def test_clean_answer_has_no_findings():
    answer = "Your capability score is trending up. Keep long runs steady and protect sleep this week."

    assert check_guardrails(answer) == []


def test_diagnosis_language_is_flagged():
    answer = "Based on your resting heart rate, you have an early-stage heart condition."

    findings = check_guardrails(answer)

    assert findings == ["Answer may state or imply a medical diagnosis."]


def test_diagnose_verb_is_flagged():
    answer = "Atlas cannot diagnose you, but here is what the data shows."

    findings = check_guardrails(answer)

    assert findings == ["Answer may state or imply a medical diagnosis."]


def test_medication_dosing_language_is_flagged():
    answer = "For the soreness, take 400mg ibuprofen before your next long run."

    findings = check_guardrails(answer)

    assert findings == ["Answer may include medication or dosing guidance."]


def test_discouraging_medical_care_is_flagged():
    answer = "Your resting heart rate is elevated, but there's no need to see a doctor about it."

    findings = check_guardrails(answer)

    assert findings == ["Answer may discourage seeking medical care."]


def test_multiple_categories_are_all_reported_once_each():
    answer = (
        "You have a sleep disorder - take 10mg of the usual medication and there's no need to "
        "see a doctor about it. You have a sleep disorder either way."
    )

    findings = check_guardrails(answer)

    assert findings == [
        "Answer may state or imply a medical diagnosis.",
        "Answer may include medication or dosing guidance.",
        "Answer may discourage seeking medical care.",
    ]
