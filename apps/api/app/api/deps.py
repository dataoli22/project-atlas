from app.core.config import Settings, get_settings
from app.features.shared.schemas.app import UserSummary


def get_app_settings() -> Settings:
    return get_settings()


def get_current_user() -> UserSummary:
    return UserSummary(
        id="local-user",
        email="atlas@example.local",
        display_name="Atlas User",
    )
