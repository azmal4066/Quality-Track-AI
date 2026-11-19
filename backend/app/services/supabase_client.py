from functools import lru_cache
from supabase import Client, create_client
from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    return create_client(s.supabase_url, s.supabase_service_role_key)


def signed_url(bucket: str, path: str | None, expires: int = 3600) -> str | None:
    if not path:
        return None
    res = get_supabase().storage.from_(bucket).create_signed_url(path, expires)
    return res.get("signedURL") or res.get("signedUrl")
