from fastapi import APIRouter, Depends
from app.core.config import get_settings
from app.core.security import get_current_user
from app.services.yolo_service import yolo_service

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/model/status")
def model_status(_=Depends(get_current_user)):
    return {**yolo_service.status(), "demo_enabled": get_settings().demo_mode_enabled}
