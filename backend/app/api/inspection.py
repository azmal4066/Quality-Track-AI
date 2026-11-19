import logging
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Request
from app.core.config import get_settings
from app.core.security import CurrentUser, require_staff, get_current_user
from app.services.supabase_client import get_supabase, signed_url
from app.services.yolo_service import yolo_service, ModelUnavailable, InvalidImage
from app.services.app_settings import get_thresholds
from app.services.decision import decide, quality_score, severity_from_confidence

log = logging.getLogger("inspection")
router = APIRouter(prefix="/api/inspection", tags=["inspection"])
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")


async def read_validated(file: UploadFile) -> bytes:
    s = get_settings()
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Only JPG, PNG or WEBP images are supported")
    data = await file.read()
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {s.max_upload_mb} MB")
    if not data.startswith(MAGIC):
        raise HTTPException(415, "File content does not match an image format")
    return data


def run_one(data: bytes, content_type: str, user: CurrentUser, product_code: str | None,
            batch_number: str | None, notes: str | None) -> dict:
    s = get_settings()
    try:
        result = yolo_service.predict(data)
    except ModelUnavailable as e:
        raise HTTPException(503, {"code": "MODEL_UNAVAILABLE", "message": str(e),
                                  "setup_hint": "Train or download weights and set YOLO_MODEL_PATH."})
    except InvalidImage as e:
        raise HTTPException(422, str(e))

    confs = [d.confidence for d in result.detections]
    pass_max, fail_min = get_thresholds()
    status_ = decide(confs, pass_max, fail_min)
    score = quality_score(confs)
    sb = get_supabase()

    product_id = None
    if product_code:
        p = sb.table("products").select("id").eq("product_code", product_code).limit(1).execute()
        product_id = p.data[0]["id"] if p.data else None

    iid = str(uuid.uuid4())
    ext = ALLOWED[content_type]
    orig_path, ann_path = f"{iid}/original.{ext}", f"{iid}/annotated.jpg"
    sb.storage.from_("inspection-images").upload(orig_path, data, {"content-type": content_type})
    sb.storage.from_("annotated-images").upload(ann_path, result.annotated_jpeg, {"content-type": "image/jpeg"})

    sb.table("inspections").insert({
        "id": iid, "product_id": product_id, "inspector_id": user.id, "batch_number": batch_number,
        "original_image_url": orig_path, "annotated_image_url": ann_path, "status": status_,
        "quality_score": score, "max_confidence": max(confs) if confs else None,
        "defect_count": len(confs), "model_version": s.model_version, "notes": notes,
    }).execute()
    if result.detections:
        sb.table("defects").insert([{
            "inspection_id": iid, "defect_type": d.label, "confidence": d.confidence,
            "bbox": d.bbox, "severity": severity_from_confidence(d.confidence),
        } for d in result.detections]).execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": "inspection.create",
                                   "entity_type": "inspection", "entity_id": iid}).execute()
    return {
        "id": iid, "status": status_, "quality_score": score, "defect_count": len(confs),
        "max_confidence": max(confs) if confs else None, "model_version": s.model_version,
        "detections": [d.dict() for d in result.detections],
        "original_url": signed_url("inspection-images", orig_path),
        "annotated_url": signed_url("annotated-images", ann_path),
    }


@router.post("/analyze")
async def analyze(file: UploadFile = File(...), product_code: str | None = Form(None),
                  batch_number: str | None = Form(None), notes: str | None = Form(None),
                  user: CurrentUser = Depends(require_staff)):
    data = await read_validated(file)
    return run_one(data, file.content_type, user, product_code, batch_number, notes)


@router.post("/demo")
async def demo(file: UploadFile = File(...), user: CurrentUser = Depends(require_staff)):
    """DEMO ONLY: draws a placeholder box + watermark. Not a model prediction and never saved."""
    import base64, io
    from PIL import Image, ImageDraw
    if not get_settings().demo_mode_enabled:
        raise HTTPException(403, "Demo mode is disabled. Set DEMO_MODE_ENABLED=true to enable it.")
    data = await read_validated(file)
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(422, "Could not read image")
    w, h = img.size
    d = ImageDraw.Draw(img)
    d.rectangle([w * .3, h * .3, w * .6, h * .55], outline=(245, 158, 11), width=max(2, w // 200))
    d.text((w * .3, h * .3 - 12), "DEMO SAMPLE BOX", fill=(245, 158, 11))
    d.rectangle([0, 0, w, 22], fill=(245, 158, 11))
    d.text((6, 6), "DEMO MODE - NOT A REAL PREDICTION - NOT SAVED", fill=(0, 0, 0))
    out = io.BytesIO(); img.save(out, "JPEG", quality=85)
    return {"demo": True, "notice": "Placeholder output. No model was run and nothing was saved.",
            "annotated_data_url": "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()}


@router.post("/batch/finalize")
def finalize_batch(batch_number: str = Form(...), user: CurrentUser = Depends(require_staff)):
    """Recomputes batch counters from stored inspections (used after per-image batch processing)."""
    sb = get_supabase()
    rows = sb.table("inspections").select("status").eq("batch_number", batch_number).execute().data
    counts = {"total_items": len(rows), "passed_items": sum(r["status"] == "PASS" for r in rows),
              "failed_items": sum(r["status"] == "FAIL" for r in rows)}
    sb.table("batches").upsert({"batch_number": batch_number, **counts}, on_conflict="batch_number").execute()
    return {"batch_number": batch_number, **counts}


@router.post("/batch")
async def batch(files: list[UploadFile] = File(...), batch_number: str = Form(...),
                product_code: str | None = Form(None), user: CurrentUser = Depends(require_staff)):
    if len(files) > 50:
        raise HTTPException(400, "Maximum 50 images per batch")
    items, passed, failed = [], 0, 0
    for f in files:
        try:
            data = await read_validated(f)
            r = run_one(data, f.content_type, user, product_code, batch_number, None)
            items.append({"filename": f.filename, "ok": True, **r})
            passed += r["status"] == "PASS"
            failed += r["status"] == "FAIL"
        except HTTPException as e:
            if e.status_code == 503:
                raise
            items.append({"filename": f.filename, "ok": False, "error": e.detail})
    get_supabase().table("batches").upsert({
        "batch_number": batch_number, "total_items": len(files),
        "passed_items": passed, "failed_items": failed}, on_conflict="batch_number").execute()
    return {"batch_number": batch_number, "total": len(files), "passed": passed, "failed": failed, "items": items}


@router.get("/history")
def history(limit: int = 50, offset: int = 0, status: str | None = None, batch: str | None = None,
            date_from: str | None = None, date_to: str | None = None, product_code: str | None = None,
            defect_type: str | None = None, inspector_id: str | None = None,
            user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    q = sb.table("inspections").select("*, products(product_code,name)") \
        .order("created_at", desc=True).range(offset, offset + min(limit, 200) - 1)
    if status: q = q.eq("status", status)
    if batch: q = q.eq("batch_number", batch)
    if inspector_id: q = q.eq("inspector_id", inspector_id)
    if date_from: q = q.gte("created_at", date_from)
    if date_to:
        try:
            nxt = (datetime.fromisoformat(date_to) + timedelta(days=1)).date().isoformat()
        except ValueError:
            raise HTTPException(422, "date_to must be YYYY-MM-DD")
        q = q.lt("created_at", nxt)
    if product_code:
        pr = sb.table("products").select("id").ilike("product_code", product_code).execute().data
        if not pr:
            return []
        q = q.in_("product_id", [x["id"] for x in pr])
    if defect_type:
        ids = [d["inspection_id"] for d in sb.table("defects").select("inspection_id").eq("defect_type", defect_type).execute().data]
        if not ids:
            return []
        q = q.in_("id", list(set(ids)))
    return q.execute().data


@router.get("/{inspection_id}")
def get_one(inspection_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    r = sb.table("inspections").select("*, products(product_code,name)").eq("id", inspection_id).single().execute()
    if not r.data:
        raise HTTPException(404, "Inspection not found")
    d = sb.table("defects").select("*").eq("inspection_id", inspection_id).execute().data
    r.data["original_url"] = signed_url("inspection-images", r.data["original_image_url"])
    r.data["annotated_url"] = signed_url("annotated-images", r.data["annotated_image_url"])
    return {**r.data, "defects": d}


@router.delete("/{inspection_id}", status_code=204)
def delete(inspection_id: str, user: CurrentUser = Depends(require_staff)):
    if user.role == "inspector":
        raise HTTPException(403, "Only admins can delete inspections")
    sb = get_supabase()
    sb.table("inspections").delete().eq("id", inspection_id).execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": "inspection.delete",
                                   "entity_type": "inspection", "entity_id": inspection_id}).execute()
