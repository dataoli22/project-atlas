from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.features.endurance.health_query import query_health_data
from app.features.endurance.schemas import (
    EnduranceDashboardResponse,
    EnduranceDisciplineKpiResponse,
    EnduranceGoal,
    EnduranceGoalRequest,
    EnduranceInsightsResponse,
    EnduranceTimelineResponse,
    EnduranceTrainingPlanResponse,
    EnduranceWeeklyVolumeTrendResponse,
)
from app.features.endurance.service import (
    generate_training_plan,
    get_endurance_dashboard,
    get_endurance_discipline_kpis,
    get_endurance_goal,
    get_endurance_insights,
    get_endurance_timeline,
    get_stub_dashboard,
    get_stub_insights,
    get_stub_timeline,
    get_weekly_volume_trend,
    save_endurance_goal,
)
from app.features.shared.schemas.health import BodyWeightMetric, HydrationMetric

router = APIRouter()


class EnduranceStatus(BaseModel):
    feature: str = "endurance"
    # Describes the shared metric contract shapes this feature exposes, not a live subsystem
    # health check - "placeholder" previously implied the endpoint itself was unimplemented, when
    # it's always returned real, working data. "available" reflects what this actually reports.
    status: str = "available"
    shared_contracts: dict[str, dict[str, str]]


@router.get("", response_model=EnduranceStatus)
def read_endurance_status() -> EnduranceStatus:
    return EnduranceStatus(
        shared_contracts={
            "hydration": HydrationMetric(amount=500, unit="ml").model_dump(),
            "body_weight": BodyWeightMetric(value=70, unit="kg").model_dump(),
        }
    )


@router.get("/dashboard", response_model=EnduranceDashboardResponse)
def read_endurance_dashboard() -> EnduranceDashboardResponse:
    return get_endurance_dashboard()


@router.get("/timeline", response_model=EnduranceTimelineResponse)
def read_endurance_timeline() -> EnduranceTimelineResponse:
    return get_endurance_timeline()


@router.get("/insights", response_model=EnduranceInsightsResponse)
def read_endurance_insights() -> EnduranceInsightsResponse:
    return get_endurance_insights()


class EnduranceHealthQueryResponse(BaseModel):
    matched_metric: str | None
    sessions: list[dict]
    metric_readings: list[dict]


@router.get("/query", response_model=EnduranceHealthQueryResponse)
def query_endurance_health_data(
    question: str = Query(min_length=1, max_length=200),
) -> EnduranceHealthQueryResponse:
    """A real query layer over synced health/fitness history for the dashboard - the same
    retrieval Ask Atlas chat uses (agent_runtime.py's grounding), exposed directly so a dashboard
    widget can ask e.g. "what was my sleep last week" without going through chat."""
    result = query_health_data(question)
    return EnduranceHealthQueryResponse(
        matched_metric=result.matched_metric,
        sessions=result.sessions,
        metric_readings=result.metric_readings,
    )


@router.get("/kpis/discipline-split", response_model=EnduranceDisciplineKpiResponse)
def read_endurance_discipline_kpis() -> EnduranceDisciplineKpiResponse:
    """Real triathlon-relevant KPIs: total distance/time per discipline (run/bike/swim), summed
    from actual synced sessions' sport_type over the last 7 and 30 days. Backs the capability
    page's "current strengths by discipline" widget."""
    return get_endurance_discipline_kpis()


@router.get("/kpis/weekly-volume", response_model=EnduranceWeeklyVolumeTrendResponse)
def read_endurance_weekly_volume_trend() -> EnduranceWeeklyVolumeTrendResponse:
    """Real chronological weekly-volume history from actual synced session history. Backs the
    timeline page's "history over time" widget."""
    return get_weekly_volume_trend()


@router.get("/goal", response_model=EnduranceGoal)
def read_endurance_goal() -> EnduranceGoal:
    return get_endurance_goal()


@router.post("/goal", response_model=EnduranceGoal)
def write_endurance_goal(payload: EnduranceGoalRequest) -> EnduranceGoal:
    try:
        return save_endurance_goal(
            goal_type=payload.goal_type,
            target_distance_km=payload.target_distance_km,
            target_time_minutes=payload.target_time_minutes,
            target_date=payload.target_date,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/training-plan", response_model=EnduranceTrainingPlanResponse)
def read_endurance_training_plan() -> EnduranceTrainingPlanResponse:
    """A deterministic, rules-based weekly training plan (see generate_training_plan's
    docstring for the heuristic used) built from the saved goal plus real recent training
    volume. Returns has_goal=False with no weeks if no goal has been set yet."""
    return generate_training_plan()
