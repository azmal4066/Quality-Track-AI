from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import CurrentUser, get_current_user, require_admin
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/settings", tags=["settings"])
KEYS = {"thresholds", "defect_categories", "product_categories", "company", "notifications"}


class SettingBody(BaseModel):
    value: Any


@router.get("")
def all_settings(_=Depends(get_current_user)):
    rows = get_supabase().table("settings").select("key,value").execute().data
    return {r["key"]: r["value"] for r in rows}


@router.put("/{key}")
def put_setting(key: str, body: SettingBody, user: CurrentUser = Depends(require_admin)):
    if key not in KEYS:
        raise HTTPException(404, "Unknown setting")
    v = body.value
    if key == "thresholds":
        try:
            lo, hi = float(v["pass_max_confidence"]), float(v["fail_min_confidence"])
        except Exception:
            raise HTTPException(422, "Both thresholds are required numbers")
        if not (0 <= lo < hi <= 1):
            raise HTTPException(422, "Need 0 <= pass_max < fail_min <= 1")
        v = {"pass_max_confidence": lo, "fail_min_confidence": hi}
    if key in {"defect_categories", "product_categories"}:
        if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
            raise HTTPException(422, "Expected a list of non-empty strings")
        v = list(dict.fromkeys(x.strip() for x in v))
    sb = get_supabase()
    sb.table("settings").upsert({"key": key, "value": v, "updated_at": "now()"}, on_conflict="key").execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": f"settings.update.{key}", "entity_type": "settings"}).execute()
    return {"key": key, "value": v}
