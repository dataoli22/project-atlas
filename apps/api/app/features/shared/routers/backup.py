from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.features.shared.schemas.app import (
    BackupExportResponse,
    BackupImportRequest,
    BackupImportResponse,
    PlannerGenerationHistoryEntry,
    SyncHistoryEntry,
)
from app.features.shared.services.state import shared_state

router = APIRouter()


@router.get("/backup/export", response_model=BackupExportResponse)
def export_backup() -> BackupExportResponse:
    try:
        return BackupExportResponse(**shared_state.export_backup())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/backup/import", response_model=BackupImportResponse)
def import_backup(payload: BackupImportRequest) -> BackupImportResponse:
    try:
        shared_state.import_backup(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BackupImportResponse(imported_at=datetime.now(timezone.utc).isoformat())


@router.get("/history/sync", response_model=list[SyncHistoryEntry])
def read_sync_history(source: str | None = None, limit: int = 50) -> list[SyncHistoryEntry]:
    return [
        SyncHistoryEntry(**entry)
        for entry in shared_state.get_sync_history(source=source, limit=limit)
    ]


@router.get("/history/planner", response_model=list[PlannerGenerationHistoryEntry])
def read_planner_generation_history(limit: int = 20) -> list[PlannerGenerationHistoryEntry]:
    return [
        PlannerGenerationHistoryEntry(**entry)
        for entry in shared_state.get_planner_generation_history(limit=limit)
    ]
