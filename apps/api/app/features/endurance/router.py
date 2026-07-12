from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.features.endurance.health_query import query_health_data
from app.features.endurance.schemas import (
    EnduranceDashboardResponse,
    EnduranceInsightsResponse,
    EnduranceTimelineResponse,
)
from app.features.endurance.service import (
    get_endurance_dashboard,
    get_endurance_insights,
    get_endurance_timeline,
    get_stub_dashboard,
    get_stub_insights,
    get_stub_timeline,
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
