from fastapi import APIRouter

from app.features.shared.schemas.app import LoginRequest, LoginResponse, UserSummary

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    user = UserSummary(
        id="local-user",
        email=payload.email,
        display_name="Atlas User",
    )
    return LoginResponse(access_token="atlas-dev-token", user=user)
