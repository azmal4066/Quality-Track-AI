"""PDF + CSV reports built from stored inspection records (reportlab)."""
import csv
import io
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from app.core.security import CurrentUser, require_staff
from app.services.supabase_client import get_supabase

log = logging.getLogger("reports")
router = APIRouter(prefix="/api/reports", tags=["reports"])
ST = getSampleStyleSheet()


class ReportRequest(BaseModel):
    type: Literal["inspection", "batch", "monthly", "csv"]
    inspection_id: str | None = None
    batch_number: str | None = None
    month: str | None = None  # YYYY-MM


def _tbl(rows, widths=None):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 8),
                           ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def _img(bucket: str, path: str | None, w=80 * mm):
    if not path:
        return Paragraph("(no image)", ST["Normal"])
    try:
        data = get_supabase().storage.from_(bucket).download(path)
        im = Image(io.BytesIO(data))
        ratio = im.imageHeight / im.imageWidth
        im.drawWidth, im.drawHeight = w, w * ratio
        return im
    except Exception:
        log.exception("image fetch failed")
        return Paragraph("(image unavailable)", ST["Normal"])


def _doc(story) -> bytes:
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm).build(story)
    return buf.getvalue()


def _head(title: str):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return [Paragraph("QualityTrack AI", ST["Title"]), Paragraph(title, ST["Heading2"]), Paragraph(f"Generated {now}", ST["Normal"]), Spacer(1, 8)]


def _fetch_inspection(iid: str):
    sb = get_supabase()
    r = sb.table("inspections").select("*, products(product_code,name,category), profiles(full_name,email)").eq("id", iid).limit(1).execute().data
    if not r:
        raise HTTPException(404, "Inspection not found")
    d = sb.table("defects").select("*").eq("inspection_id", iid).execute().data
    return r[0], d


def inspection_pdf(iid: str) -> bytes:
    i, defects = _fetch_inspection(iid)
    p, who = i.get("products") or {}, i.get("profiles") or {}
    s = _head(f"Inspection report {i['id']}")
    s.append(_tbl([["Field", "Value"], ["Product", f"{p.get('product_code', '-')} {p.get('name', '')}"], ["Category", p.get("category") or "-"],
                   ["Batch", i.get("batch_number") or "-"], ["Status", i["status"]], ["Quality score (0-100, derived)", str(i.get("quality_score"))],
                   ["Max model confidence", str(i.get("max_confidence"))], ["Defect count", str(i["defect_count"])],
                   ["Model version", i.get("model_version") or "-"], ["Inspector", who.get("full_name") or who.get("email") or "-"],
                   ["Date", i["created_at"]], ["Notes", i.get("notes") or "-"]], [60 * mm, 110 * mm]))
    s += [Spacer(1, 8), Table([[_img("inspection-images", i.get("original_image_url")), _img("annotated-images", i.get("annotated_image_url"))],
                               ["Original", "Annotated"]])]
    rows = [["Defect", "Severity", "Confidence", "Status", "Corrective action"]] + \
           [[d["defect_type"], d["severity"], f"{float(d['confidence'] or 0):.2f}", d["status"], d.get("corrective_action") or "-"] for d in defects]
    s += [Spacer(1, 8), Paragraph("Detected defects", ST["Heading3"]), _tbl(rows) if defects else Paragraph("No defects detected by the model.", ST["Normal"])]
    s += [Spacer(1, 8), Paragraph("Summary", ST["Heading3"]),
          Paragraph(f"Result {i['status']} with {i['defect_count']} detected defect(s). Model confidence reflects detector certainty; quality score is a derived product score.", ST["Normal"])]
    return _doc(s)


def _list(batch=None, month=None):
    q = get_supabase().table("inspections").select("id,status,quality_score,defect_count,batch_number,created_at,products(product_code)").order("created_at")
    if batch:
        q = q.eq("batch_number", batch)
    if month:
        y, m = (int(x) for x in month.split("-"))
        end = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01"
        q = q.gte("created_at", f"{month}-01").lt("created_at", end)
    return q.execute().data


def summary_pdf(title: str, items: list[dict]) -> bytes:
    c = Counter(i["status"] for i in items)
    sc = [float(i["quality_score"]) for i in items if i["quality_score"] is not None]
    s = _head(title)
    s.append(Paragraph(f"Inspections: {len(items)} | PASS {c['PASS']} | FAIL {c['FAIL']} | REVIEW {c['REVIEW']} | "
                       f"Avg quality score: {sum(sc) / len(sc):.1f}" if sc else f"Inspections: {len(items)}", ST["Normal"]))
    s.append(Spacer(1, 8))
    s.append(_tbl([["Inspection", "Product", "Batch", "Status", "Score", "Defects", "Date"]] +
                  [[i["id"][:8], (i.get("products") or {}).get("product_code", "-"), i.get("batch_number") or "-", i["status"],
                    i["quality_score"], i["defect_count"], i["created_at"][:10]] for i in items]))
    return _doc(s)


def csv_bytes(items: list[dict]) -> bytes:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["inspection_id", "product_code", "batch", "status", "quality_score", "defect_count", "created_at"])
    for i in items:
        w.writerow([i["id"], (i.get("products") or {}).get("product_code", ""), i.get("batch_number") or "", i["status"],
                    i["quality_score"], i["defect_count"], i["created_at"]])
    return out.getvalue().encode()


@router.post("/generate")
def generate(req: ReportRequest, user: CurrentUser = Depends(require_staff)):
    if req.type == "inspection":
        if not req.inspection_id:
            raise HTTPException(422, "inspection_id required")
        body, mime, name = inspection_pdf(req.inspection_id), "application/pdf", f"inspection-{req.inspection_id[:8]}.pdf"
    elif req.type == "batch":
        if not req.batch_number:
            raise HTTPException(422, "batch_number required")
        items = _list(batch=req.batch_number)
        if not items:
            raise HTTPException(404, "No inspections for that batch")
        body, mime, name = summary_pdf(f"Batch report {req.batch_number}", items), "application/pdf", f"batch-{req.batch_number}.pdf"
    elif req.type == "monthly":
        if not req.month or len(req.month) != 7:
            raise HTTPException(422, "month (YYYY-MM) required")
        items = _list(month=req.month)
        body, mime, name = summary_pdf(f"Monthly quality report {req.month}", items), "application/pdf", f"monthly-{req.month}.pdf"
    else:
        items = _list(batch=req.batch_number, month=req.month)
        body, mime, name = csv_bytes(items), "text/csv", "inspections.csv"
    sb = get_supabase()
    sb.table("reports").insert({"inspection_id": req.inspection_id, "report_type": req.type}).execute()
    sb.table("audit_logs").insert({"user_id": user.id, "action": f"report.{req.type}", "entity_type": "report"}).execute()
    return Response(body, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/recent")
def recent(_=Depends(require_staff)):
    return get_supabase().table("reports").select("*").order("created_at", desc=True).limit(20).execute().data
