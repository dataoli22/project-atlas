from pydantic import BaseModel


class EnduranceDashboardCard(BaseModel):
    label: str
    value: str
    trend: str | None = None


class EnduranceWorkoutSummary(BaseModel):
    title: str
    duration: str
    distance: str
    recovery_note: str


class EnduranceSupportLink(BaseModel):
    title: str
    url: str
    topic: str
    why_recommended: str
    resource_type: str
    freshness_at: str | None = None


class EnduranceDashboardResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    cards: list[EnduranceDashboardCard]
    latest_workout: EnduranceWorkoutSummary
    coach_summary: str
    support_links: list[EnduranceSupportLink]


class EnduranceTimelineEntry(BaseModel):
    day_label: str
    session_label: str
    duration: str
    load: str
    source: str


class EnduranceTimelineResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    entries: list[EnduranceTimelineEntry]


class EnduranceCapabilityArea(BaseModel):
    label: str
    score: int
    direction: str


class EnduranceCapabilitySnapshot(BaseModel):
    headline: str
    areas: list[EnduranceCapabilityArea]
    confidence: str = "low"
    confidence_note: str = "No connector data synced yet."


class EnduranceInsightItem(BaseModel):
    title: str
    detail: str
    priority: str


class EnduranceMedicalFlag(BaseModel):
    flag_type: str
    severity: str
    message: str
    detail: str


class EnduranceInsightsResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    capability: EnduranceCapabilitySnapshot
    insights: list[EnduranceInsightItem]
    support_links: list[EnduranceSupportLink]
    medical_flags: list[EnduranceMedicalFlag] = []
