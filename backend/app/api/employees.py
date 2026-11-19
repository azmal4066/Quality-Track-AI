import secrets
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from app.core.security import CurrentUser, require_admin
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/employees", tags=["employees"])
Role = Literal["super_admin", "admin", "inspector", "viewer"]


class NewEmployee(BaseModel):
    email: EmailStr
    full_name: str
    role: Role = "inspector"
    password: str | None = None


class EmployeeUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    full_name: str | None = None


def _check_role_grant(user: CurrentUser, role: str):
    if role == "super_admin" and user.role != "super_admin":
        raise HTTPException(403, "Only a super admin can grant the super admin role")


@router.get("")
def list_employees(user: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    people = sb.table("profiles").select("id,full_name,email,role,is_active,created_at").order("created_at").execute().data
    ins = sb.table("inspections").select("inspector_id").execute().data
    counts: dict[str, int] = {}
    for i in ins:
        if i["inspector_id"]:
            counts[i["inspector_id"]] = counts.get(i["inspector_id"], 0) + 1
    return [{**p, "inspections": counts.get(p["id"], 0)} for p in people]


@router.post("", status_code=201)
def create_employee(body: NewEmployee, user: CurrentUser = Depends(require_admin)):
    _check_role_grant(user, body.role)
    pw = body.password or secrets.token_urlsafe(12)
    if len(pw) < 8:
        raise HTTPException(422, "Password must be at least 8 characters")
    sb = get_supabase()
    try:
        res = sb.auth.admin.create_user({"email": body.email, "password": pw, "email_confirm": True,
                                         "user_metadata": {"full_name": body.full_name}})
    except Exception as e:
        raise HTTPException(400, f"Could not create user: {e}")
    uid = res.user.id
    sb.table("profiles").update({"role": body.role, "full_name": body.full_name}).eq("id", uid).execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": "employee.create", "entity_type": "profile", "entity_id": uid}).execute()
    # Temp password is only returned when the server generated it, and only once.
    return {"id": uid, "email": body.email, "role": body.role, "temporary_password": None if body.password else pw}


@router.put("/{eid}")
def update_employee(eid: str, body: EmployeeUpdate, user: CurrentUser = Depends(require_admin)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "Nothing to update")
    if eid == user.id and (data.get("is_active") is False or ("role" in data and data["role"] != user.role)):
        raise HTTPException(400, "You cannot change your own role or deactivate yourself")
    sb = get_supabase()
    target = sb.table("profiles").select("role").eq("id", eid).single().execute().data
    if not target:
        raise HTTPException(404, "Employee not found")
    if target["role"] == "super_admin" and user.role != "super_admin":
        raise HTTPException(403, "Only a super admin can modify a super admin")
    if "role" in data:
        _check_role_grant(user, data["role"])
    sb.table("profiles").update(data).eq("id", eid).execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": "employee.update", "entity_type": "profile", "entity_id": eid}).execute()
    return {"id": eid, **data}


@router.get("/{eid}/activity")
def activity(eid: str, user: CurrentUser = Depends(require_admin)):
    sb = get_supabase()
    ins = sb.table("inspections").select("id,status,batch_number,created_at").eq("inspector_id", eid) \
        .order("created_at", desc=True).limit(25).execute().data
    logs = sb.table("audit_logs").select("action,entity_type,created_at").eq("user_id", eid) \
        .order("created_at", desc=True).limit(25).execute().data
    return {"inspections": ins, "audit": logs}
