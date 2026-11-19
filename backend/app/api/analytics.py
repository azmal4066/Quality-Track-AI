from collections import Counter, defaultdict
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def overview(_=Depends(get_current_user)):
    sb = get_supabase()
    ins = sb.table("inspections").select("status,quality_score,created_at").execute().data
    defs = sb.table("defects").select("defect_type,severity,status").execute().data
    total = len(ins)
    c = Counter(i["status"] for i in ins)
    scores = [float(i["quality_score"]) for i in ins if i["quality_score"] is not None]
    return {
        "total_inspections": total, "passed": c["PASS"], "failed": c["FAIL"], "pending_review": c["REVIEW"],
        "defect_rate": round(100 * c["FAIL"] / total, 2) if total else 0,
        "avg_quality_score": round(sum(scores) / len(scores), 2) if scores else None,
        "defects_by_type": dict(Counter(d["defect_type"] for d in defs)),
        "defects_by_severity": dict(Counter(d["severity"] for d in defs)),
    }


@router.get("/trends")
def trends(_=Depends(get_current_user)):
    ins = get_supabase().table("inspections").select("status,quality_score,created_at").execute().data
    daily = defaultdict(lambda: {"PASS": 0, "FAIL": 0, "REVIEW": 0})
    for i in ins:
        daily[i["created_at"][:10]][i["status"]] += 1
    return [{"date": d, **v} for d, v in sorted(daily.items())]


@router.get("/breakdown")
def breakdown(_=Depends(get_current_user)):
    """Category, batch, inspector and monthly views, all computed from stored records."""
    sb = get_supabase()
    ins = sb.table("inspections").select("status,quality_score,batch_number,inspector_id,created_at,products(category),profiles(full_name,email)").execute().data

    def rate(rows):
        n = len(rows)
        p = sum(r["status"] == "PASS" for r in rows)
        return {"total": n, "pass": p, "fail": sum(r["status"] == "FAIL" for r in rows), "pass_rate": round(100 * p / n, 1) if n else 0}

    groups = {"category": defaultdict(list), "batch": defaultdict(list), "inspector": defaultdict(list), "month": defaultdict(list)}
    for i in ins:
        groups["category"][(i.get("products") or {}).get("category") or "Unlinked"].append(i)
        groups["batch"][i.get("batch_number") or "No batch"].append(i)
        who = i.get("profiles") or {}
        groups["inspector"][who.get("full_name") or who.get("email") or "Unknown"].append(i)
        groups["month"][i["created_at"][:7]].append(i)
    return {k: [{"name": n, **rate(v)} for n, v in sorted(g.items())] for k, g in groups.items()}
