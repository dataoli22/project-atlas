from fastapi import APIRouter

from app.features.shared.schemas.app import ChatRequest, ChatResponse
from app.features.shared.services.chat import build_chat_response
from app.features.shared.services.state import shared_state

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_with_atlas(payload: ChatRequest) -> ChatResponse:
    return build_chat_response(
        chat=payload,
        ai_settings=shared_state.get_ai_settings(),
        ollama_api_key=shared_state.get_ollama_api_key(),
        groq_api_key=shared_state.get_groq_api_key(),
    )
