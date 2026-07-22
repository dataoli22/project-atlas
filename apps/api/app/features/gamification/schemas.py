from __future__ import annotations

from pydantic import BaseModel


class StreakSummary(BaseModel):
    """Derived entirely from real synced session dates (health_sessions) - no separate
    "daily login" tracking exists in Atlas, so this deliberately measures activity consistency,
    not app-open consistency."""

    current_streak_days: int
    longest_streak_days: int
    last_active_date: str | None
    active_today: bool


class AchievementProgress(BaseModel):
    id: str
    title: str
    description: str
    category: str
    unlocked: bool
    unlocked_at: str | None
    progress_current: float
    progress_target: float


class GamificationSummaryResponse(BaseModel):
    streak: StreakSummary
    achievements: list[AchievementProgress]
    unlocked_count: int
    total_count: int
