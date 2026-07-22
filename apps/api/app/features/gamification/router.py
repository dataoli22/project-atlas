from fastapi import APIRouter

from app.features.gamification.schemas import GamificationSummaryResponse
from app.features.gamification.service import get_gamification_summary

router = APIRouter()


@router.get("/summary", response_model=GamificationSummaryResponse)
def read_gamification_summary() -> GamificationSummaryResponse:
    """Real activity streak plus achievement progress, derived entirely from already-persisted
    synced sessions, meal swaps, and plan refreshes - no separate gamification state is stored."""
    return get_gamification_summary()
