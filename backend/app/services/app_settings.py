"""Reads configurable values from the `settings` table, falling back to env defaults."""
from app.core.config import get_settings
from app.services.supabase_client import get_supabase


def get_setting(key: str, default=None):
    try:
        r = get_supabase().table("settings").select("value").eq("key", key).limit(1).execute()
        return r.data[0]["value"] if r.data else default
    except Exception:
        return default


def get_thresholds() -> tuple[float, float]:
    s = get_settings()
    t = get_setting("thresholds", {}) or {}
    return (float(t.get("pass_max_confidence", s.pass_max_confidence)),
            float(t.get("fail_min_confidence", s.fail_min_confidence)))
