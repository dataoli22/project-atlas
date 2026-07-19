from pydantic import BaseModel, Field


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


# Real, small enum of goal types this deterministic planner actually knows how to build a plan
# for - kept intentionally narrow (triathlon distances plus common single-discipline run
# distances) rather than accepting free text the plan generator couldn't act on.
GOAL_TYPES = (
    "5k_run",
    "10k_run",
    "half_marathon",
    "marathon",
    "sprint_triathlon",
    "olympic_triathlon",
    "half_ironman_triathlon",
    "ironman_triathlon",
    "custom",
)


class EnduranceGoal(BaseModel):
    goal_type: str
    target_distance_km: float
    target_time_minutes: float | None = None
    target_date: str | None = None
    note: str = ""
    updated_at: str | None = None
    is_set: bool = True


class EnduranceGoalRequest(BaseModel):
    goal_type: str = Field(min_length=1, max_length=40)
    target_distance_km: float = Field(gt=0, le=500)
    target_time_minutes: float | None = Field(default=None, gt=0, le=10000)
    target_date: str | None = Field(default=None, max_length=20)
    note: str = Field(default="", max_length=300)


class EnduranceDisciplineKpi(BaseModel):
    """One discipline's (run/bike/swim/other) real, summed totals over a window - built strictly
    from actual synced session sport_type values, never a fabricated split. A discipline with
    zero real sessions in the window is simply omitted, not shown as a fake zero-filled row."""

    discipline: str
    session_count: int
    total_distance_km: float
    total_duration_minutes: float


class EnduranceDisciplineKpiResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    window_label: str
    week: list[EnduranceDisciplineKpi]
    month: list[EnduranceDisciplineKpi]
    has_real_sessions: bool


class EnduranceWeeklyVolumePoint(BaseModel):
    week_label: str
    week_start_date: str
    total_distance_km: float
    total_duration_minutes: float
    session_count: int


class EnduranceWeeklyVolumeTrendResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    weeks: list[EnduranceWeeklyVolumePoint]
    has_real_sessions: bool


class EnduranceTrainingPlanSession(BaseModel):
    discipline: str
    sessions_per_week: int
    focus: str
    target_distance_km: float | None = None


class EnduranceTrainingPlanWeek(BaseModel):
    week_number: int
    label: str
    long_session_distance_km: float
    total_distance_km: float
    note: str


class EnduranceTrainingPlanResponse(BaseModel):
    generated_at: str
    active_feature: str = "endurance"
    has_goal: bool
    goal: EnduranceGoal | None = None
    methodology_note: str
    baseline_weekly_distance_km: float
    sessions_by_discipline: list[EnduranceTrainingPlanSession] = Field(default_factory=list)
    weeks: list[EnduranceTrainingPlanWeek] = Field(default_factory=list)
