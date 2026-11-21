"""LLM assistant. Grounded in real DB aggregates; never claims to have inspected an image."""
import logging
from collections import Counter
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.config import get_settings
from app.core.security import get_current_user
from app.services.supabase_client import get_supabase

log = logging.getLogger("assistant")
router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class Msg(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class Chat(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=20)
    inspection_id: str | None = None


SYSTEM = """You are the QualityTrack AI assistant for a manufacturing quality team.
Rules: use ONLY the DATA block for facts about this company's inspections. If the data does not contain the answer, say so.
You cannot see or inspect images; never claim you inspected one. Only describe inspections that appear in DATA.
Model confidence (how sure the detector is about a box) is different from quality score (derived 0-100 product score).
Corrective actions you suggest are general guidance, not verified engineering advice.
App pages: Dashboard, AI Inspection, Batch Inspection, Defect Management, Products, Inspection History, Quality Analytics, Reports, Employees (admin), Settings."""


def build_context(inspection_id: str | None, user_id: str) -> str:
    sb = get_supabase()
    ins = sb.table("inspections").select("id,status,quality_score,batch_number,defect_count,created_at").eq("inspector_id", user_id).order("created_at", desc=True).limit(500).execute().data
    defs = sb.table("defects").select("defect_type,severity,status,inspections!inner(inspector_id)").eq("inspections.inspector_id", user_id).limit(2000).execute().data
    c = Counter(i["status"] for i in ins)
    lines = [f"Inspections (latest {len(ins)}): PASS={c['PASS']} FAIL={c['FAIL']} REVIEW={c['REVIEW']}",
             f"Defects by type: {dict(Counter(d['defect_type'] for d in defs))}",
             f"Defects by severity: {dict(Counter(d['severity'] for d in defs))}",
             f"Defects by status: {dict(Counter(d['status'] for d in defs))}"]
    if inspection_id:
        r = sb.table("inspections").select("*").eq("id", inspection_id).eq("inspector_id", user_id).limit(1).execute().data
        if r:
            d = sb.table("defects").select("defect_type,severity,confidence,status,corrective_action").eq("inspection_id", inspection_id).execute().data
            lines.append(f"Selected inspection: {r[0]} defects={d}")
    return "\n".join(lines)


@router.post("/chat")
def chat(body: Chat, user=Depends(get_current_user)):
    s = get_settings()
    if not s.ai_api_key or not s.ai_model:
        raise HTTPException(503, {"code": "ASSISTANT_UNAVAILABLE",
                                  "message": "AI assistant is not configured. Set AI_API_KEY and AI_MODEL in backend/.env."})
    payload = {"model": s.ai_model, "max_tokens": 800, "system": f"{SYSTEM}\n\nDATA:\n{build_context(body.inspection_id, user.id)}",
               "messages": [m.model_dump() for m in body.messages]}
    try:
        r = httpx.post(s.ai_api_url, json=payload, timeout=60,
                       headers={"x-api-key": s.ai_api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json().get("content", []))
    except Exception:
        log.exception("LLM call failed")
        raise HTTPException(502, "The AI provider request failed. Check AI_API_KEY / AI_MODEL.")
    return {"reply": text}
