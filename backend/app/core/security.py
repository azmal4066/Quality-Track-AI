"""Server-side auth: verifies the Supabase access token, loads the role from `profiles`."""
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.services.supabase_client import get_supabase

bearer = HTTPBearer(auto_error=False)
STAFF = {"super_admin", "admin", "inspector"}
ADMIN = {"super_admin", "admin"}


@dataclass
class CurrentUser:
    id: str
    email: str | None
    role: str


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> CurrentUser:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    sb = get_supabase()
    try:
        u = sb.auth.get_user(creds.credentials)
        uid = u.user.id
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    res = sb.table("profiles").select("role,is_active,email").eq("id", uid).single().execute()
    if not res.data or not res.data.get("is_active"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account inactive or not found")
    return CurrentUser(id=uid, email=res.data.get("email"), role=res.data["role"])


def require_roles(allowed: set[str]):
    def dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return dep


require_staff = require_roles(STAFF)
require_admin = require_roles(ADMIN)
