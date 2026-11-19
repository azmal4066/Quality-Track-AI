from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal
from app.core.security import get_current_user, require_staff
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/defects", tags=["defects"])
SORTABLE = {"created_at", "severity", "status", "defect_type", "confidence"}


class DefectUpdate(BaseModel):
    status: Literal["open", "under_review", "resolved", "closed"] | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    corrective_action: str | None = None
    description: str | None = None
    assigned_to: str | None = None


SORTABLE = {"created_at", "defect_type", "severity", "confidence", "status"}


@router.get("")
def list_defects(status: str | None = None, severity: str | None = None, q: str | None = None,
                 sort: str = "created_at", desc: bool = True,
                 limit: int = 25, offset: int = 0, _=Depends(get_current_user)):
    if sort not in SORTABLE:
        raise HTTPException(422, f"sort must be one of {sorted(SORTABLE)}")
    qry = get_supabase().table("defects") \
        .select("*, assignee:profiles!assigned_to(full_name,email), inspections(batch_number, products(product_code))", count="exact") \
        .order(sort, desc=desc).range(offset, offset + min(limit, 100) - 1)
    if status: qry = qry.eq("status", status)
    if severity: qry = qry.eq("severity", severity)
    if q: qry = qry.ilike("defect_type", f"%{q}%")
    r = qry.execute()
    return {"items": r.data, "total": r.count}


@router.put("/{did}")
def update(did: str, body: DefectUpdate, _=Depends(require_staff)):
    r = get_supabase().table("defects").update(body.model_dump(exclude_none=True)).eq("id", did).execute()
    if not r.data:
        raise HTTPException(404, "Defect not found")
    return r.data[0]
