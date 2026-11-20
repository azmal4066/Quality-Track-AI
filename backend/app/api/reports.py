"""PDF + CSV reports built from stored inspection records (reportlab)."""
import csv
import io
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from PIL import Image as PILImage, ImageOps
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
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


IST = timezone(timedelta(hours=5, minutes=30))
INSTITUTION = "SRM Institute of Science and Technology, Tiruchirappalli"
NAVY, BLUE, CYAN = colors.HexColor("#0F2A4A"), colors.HexColor("#3B82F6"), colors.HexColor("#06B6D4")
INK, MUTE, LINE, ZEBRA = colors.HexColor("#0F172A"), colors.HexColor("#64748B"), colors.HexColor("#CBD5E1"), colors.HexColor("#F1F5F9")
STATUS_HEX = {"PASS": "#15803D", "FAIL": "#B91C1C", "REVIEW": "#B45309"}
SEVERITY_HEX = {"low": "#0E7490", "medium": "#B45309", "high": "#C2410C", "critical": "#B91C1C"}

H2 = ParagraphStyle("qt_h2", parent=ST["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=NAVY, spaceBefore=10, spaceAfter=6, keepWithNext=1)
BODY = ParagraphStyle("qt_body", parent=ST["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=INK)
CELL = ParagraphStyle("qt_cell", parent=BODY, fontSize=8.5, leading=11)
CELL_B = ParagraphStyle("qt_cell_b", parent=CELL, fontName="Helvetica-Bold")
HCELL = ParagraphStyle("qt_hcell", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
SMALL = ParagraphStyle("qt_small", parent=BODY, fontSize=8, leading=10, textColor=MUTE)
TITLE = ParagraphStyle("qt_title", parent=ST["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, alignment=0, spaceAfter=2)
SUBTITLE = ParagraphStyle("qt_sub", parent=BODY, fontSize=9.5, textColor=MUTE)
CONTENT_W = A4[0] - 30 * mm


def _clean(v) -> str:
    """PDF base fonts only cover Latin text. Anything else (emoji, Tamil, arrows...) becomes '?' instead of garbage boxes."""
    return str(v).encode("cp1252", "replace").decode("cp1252")


def _esc(v, n: int | None = None) -> str:
    """Safe text for Paragraph cells: escaped, Latin-only, optionally shortened so one huge value can never break the layout."""
    t = "-" if v is None or v == "" else " ".join(_clean(v).split())
    if n and len(t) > n:
        t = t[: n - 1] + "\u2026"
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fmt_dt(v) -> str:
    """Stored UTC timestamps -> readable IST, e.g. 20 Nov 2026, 06:36 AM IST."""
    if not v:
        return "-"
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
    except ValueError:
        return str(v)


def _num(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _now() -> str:
    return datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")


def _status(v) -> str:
    return f'<font color="{STATUS_HEX.get(str(v), "#0F172A")}"><b>{_esc(v, 12)}</b></font>'


def _tbl(rows, widths=None, zebra=True):
    """Data table; rows[0] is the header. Plain strings are wrapped so long text never overflows."""
    data = [[Paragraph(str(c) if i else _esc(c), HCELL if i == 0 else CELL) if not hasattr(c, "wrap") else c for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), NAVY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
          ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
          ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]
    if zebra:
        st += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ZEBRA])]
    t.setStyle(TableStyle(st))
    return t


def _kv(pairs):
    """Two label/value pairs per row."""
    rows, lab = [], ParagraphStyle("qt_lab", parent=SMALL, textColor=MUTE, fontName="Helvetica-Bold")
    for k in range(0, len(pairs), 2):
        row = []
        for key, val in pairs[k:k + 2]:
            row += [Paragraph(_esc(key).upper(), lab), Paragraph(_esc(val, 500), CELL_B)]
        while len(row) < 4:
            row += ["", ""]
        rows.append(row)
    t = Table(rows, colWidths=[32 * mm, 53 * mm, 32 * mm, 53 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                           ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("BACKGROUND", (0, 0), (-1, -1), colors.white)]))
    return t


def _kpis(items):
    """Big-number strip. items = [(label, value_markup, hex_color)]."""
    big = lambda txt, col: Paragraph(f'<font size="17" color="{col}"><b>{txt}</b></font>', ParagraphStyle("qt_big", parent=BODY, leading=21, alignment=1))
    lab = ParagraphStyle("qt_klab", parent=SMALL, alignment=1)
    n = len(items)
    t = Table([[big(v, c) for _, v, c in items], [Paragraph(l.upper(), lab) for l, _, _ in items]], colWidths=[CONTENT_W / n] * n)
    st = [("BOX", (0, 0), (-1, -1), 0.6, LINE), ("BACKGROUND", (0, 0), (-1, -1), ZEBRA), ("TOPPADDING", (0, 0), (-1, 0), 9), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
          ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    st += [("LINEAFTER", (i, 0), (i, -1), 0.4, LINE) for i in range(n - 1)]
    t.setStyle(TableStyle(st))
    return t


def _img(bucket: str, path: str | None, w=72 * mm):
    if not path:
        return Paragraph("(no image)", SMALL)
    try:
        data = get_supabase().storage.from_(bucket).download(path)
        pil = ImageOps.exif_transpose(PILImage.open(io.BytesIO(data))).convert("RGB")
        pil.thumbnail((1400, 1400))
        buf = io.BytesIO()
        pil.save(buf, "JPEG", quality=85)
        buf.seek(0)
        im = Image(buf)
        ratio = im.imageHeight / im.imageWidth
        im.drawWidth, im.drawHeight = w, min(w * ratio, 52 * mm)
        if w * ratio > 52 * mm:
            im.drawWidth = 52 * mm / ratio
        return im
    except Exception:
        log.exception("image fetch failed")
        return Paragraph("(image unavailable)", SMALL)


class _Numbered(rl_canvas.Canvas):
    """Canvas that draws the page header band and a 'Page x of y' footer on every page."""

    def __init__(self, *a, report_title="", **k):
        super().__init__(*a, **k)
        self._pages, self._report_title = [], report_title

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            self._decorate(total)
            super().showPage()
        super().save()

    def _decorate(self, total):
        w, h = A4
        self.saveState()
        self.setFillColor(NAVY)
        self.rect(0, h - 20 * mm, w, 20 * mm, stroke=0, fill=1)
        self.setFillColor(CYAN)
        self.rect(0, h - 20.8 * mm, w, 0.8 * mm, stroke=0, fill=1)
        self.setFillColor(BLUE)
        self.roundRect(15 * mm, h - 15.5 * mm, 9 * mm, 9 * mm, 2 * mm, stroke=0, fill=1)
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 8)
        self.drawCentredString(19.5 * mm, h - 12.4 * mm, "QT")
        self.setFont("Helvetica-Bold", 13)
        self.drawString(27 * mm, h - 11.2 * mm, "QualityTrack AI")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#CBD5E1"))
        self.drawString(27 * mm, h - 15.6 * mm, INSTITUTION)
        self.setFont("Helvetica-Bold", 9)
        self.setFillColor(colors.white)
        self.drawRightString(w - 15 * mm, h - 11.2 * mm, _clean(self._report_title)[:60])
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#CBD5E1"))
        self.drawRightString(w - 15 * mm, h - 15.6 * mm, f"Generated {_now()}")
        self.setStrokeColor(LINE)
        self.setLineWidth(0.5)
        self.line(15 * mm, 13 * mm, w - 15 * mm, 13 * mm)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(MUTE)
        self.drawString(15 * mm, 8.5 * mm, f"{INSTITUTION}  |  Confidential quality record")
        self.drawRightString(w - 15 * mm, 8.5 * mm, f"Page {self._pageNumber} of {total}")
        self.restoreState()


def _doc(story, title="Quality report") -> bytes:
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=28 * mm, bottomMargin=20 * mm,
                      title=_clean(f"{title} - QualityTrack AI"), author="QualityTrack AI", subject=INSTITUTION
                      ).build(story, canvasmaker=lambda *a, **k: _Numbered(*a, report_title=title, **k))
    return buf.getvalue()


def _head(title: str, subtitle: str = ""):
    out = [Paragraph(_esc(title), TITLE)]
    if subtitle:
        out.append(Paragraph(_esc(subtitle), SUBTITLE))
    out.append(Spacer(1, 10))
    return out


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
    stc = STATUS_HEX.get(i["status"], "#0F172A")
    conf = i.get("max_confidence")
    s = _head("Inspection Report", f"Inspection ID {i['id']}")
    s.append(_kpis([("Result", _esc(i["status"]), stc), ("Defects found", _esc(i.get("defect_count")), "#0F172A"),
                    ("Quality score", _esc(i.get("quality_score"), 8), "#0F172A"), ("Top confidence", f"{_num(conf):.2f}" if conf is not None else "-", "#0F172A")]))
    s += [Spacer(1, 10), Paragraph("Inspection details", H2)]
    s.append(_kv([("Product", f"{p.get('product_code') or '-'}  {p.get('name') or ''}".strip()), ("Category", p.get("category") or "-"),
                  ("Batch", i.get("batch_number") or "-"), ("Inspector", who.get("full_name") or who.get("email") or "-"),
                  ("Inspected on", _fmt_dt(i.get("created_at"))), ("Model version", i.get("model_version") or "-"),
                  ("Notes", i.get("notes") or "-"), ("Report generated", _now())]))
    cap = ParagraphStyle("qt_cap", parent=SMALL, alignment=1)
    imgs = Table([[_img("inspection-images", i.get("original_image_url")), _img("annotated-images", i.get("annotated_image_url"))],
                  [Paragraph("Original image", cap), Paragraph("Annotated image (model detections)", cap)]], colWidths=[CONTENT_W / 2] * 2)
    imgs.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("BACKGROUND", (0, 0), (-1, 0), ZEBRA)]))
    s += [Paragraph("Images", H2), imgs, Paragraph("Detected defects", H2)]
    if defects:
        rows = [["#", "Defect", "Severity", "Confidence", "Status", "Corrective action"]]
        for n, d in enumerate(defects, 1):
            sev = str(d.get("severity") or "-")
            rows.append([str(n), _esc(d["defect_type"], 40), f'<font color="{SEVERITY_HEX.get(sev, "#0F172A")}"><b>{_esc(sev, 12)}</b></font>',
                         f"{_num(d.get('confidence')):.2f}", _esc(str(d["status"]).replace("_", " "), 20), _esc(d.get("corrective_action"), 300)])
        s.append(_tbl(rows, [8 * mm, 34 * mm, 22 * mm, 24 * mm, 26 * mm, CONTENT_W - 114 * mm]))
    else:
        s.append(Paragraph("No defects were detected by the model for this inspection.", BODY))
    verdict = {"PASS": "meets the acceptance threshold", "FAIL": "exceeds the failure threshold and needs corrective action",
               "REVIEW": "is borderline and needs manual review"}.get(i["status"], "was recorded")
    s += [Paragraph("Summary", H2),
          Paragraph(f"This unit <b>{verdict}</b>. The model detected {_esc(i.get('defect_count'))} defect(s). Model confidence shows how certain the detector is; "
                    "the quality score (0-100) is a derived product score. They are different measures.", BODY), Spacer(1, 10)]
    sign = Table([[Paragraph("Inspected by", SMALL), Paragraph("Signature", SMALL), Paragraph("Date", SMALL)],
                  [Paragraph(_esc(who.get("full_name") or who.get("email"), 60), CELL_B), "", ""]], colWidths=[CONTENT_W / 3] * 3, rowHeights=[None, 14 * mm])
    sign.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE), ("VALIGN", (0, 1), (-1, 1), "BOTTOM"), ("LINEBELOW", (0, 1), (-1, 1), 0.6, LINE)]))
    s.append(KeepTogether([sign]))
    return _doc(s, "Inspection Report")


def _list(batch=None, month=None):
    q = get_supabase().table("inspections").select("id,status,quality_score,defect_count,batch_number,created_at,products(product_code)").order("created_at")
    if batch:
        q = q.eq("batch_number", batch)
    if month:
        try:
            y, m = (int(x) for x in month.split("-"))
            assert 1 <= m <= 12 and len(month) == 7
        except (ValueError, AssertionError):
            raise ValueError("Month must look like YYYY-MM, e.g. 2026-11")
        end = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01"
        q = q.gte("created_at", f"{month}-01").lt("created_at", end)
    return q.execute().data


def _defect_types(items: list[dict]) -> Counter:
    ids = [i["id"] for i in items if i.get("id")]
    c: Counter = Counter()
    try:
        sb = get_supabase()
        for k in range(0, len(ids), 100):
            for d in sb.table("defects").select("defect_type").in_("inspection_id", ids[k:k + 100]).execute().data:
                c[d.get("defect_type") or "unknown"] += 1
    except Exception:
        log.exception("defect breakdown failed")
    return c


def summary_pdf(title: str, items: list[dict]) -> bytes:
    c = Counter(i.get("status") for i in items)
    sc = [_num(i.get("quality_score")) for i in items if i.get("quality_score") is not None]
    total = len(items)
    pass_rate = f"{100 * c['PASS'] / total:.1f}%" if total else "-"
    s = _head(title, f"{total} inspection(s) included  |  Times shown in IST")
    if not total:
        s.append(Paragraph("No inspections were found for this selection.", BODY))
        return _doc(s, title)
    s.append(_kpis([("Inspections", str(total), "#0F172A"), ("Pass rate", pass_rate, "#15803D"), ("Pass", str(c["PASS"]), "#15803D"),
                    ("Fail", str(c["FAIL"]), "#B91C1C"), ("Review", str(c["REVIEW"]), "#B45309"),
                    ("Avg score", f"{sum(sc) / len(sc):.1f}" if sc else "-", "#0F172A")]))
    dt = _defect_types(items)
    if dt:
        s += [Paragraph("Defects by type", H2),
              _tbl([["Defect type", "Count", "Share"]] + [[_esc(k, 60), str(v), f"{100 * v / sum(dt.values()):.1f}%"] for k, v in dt.most_common(8)],
                   [CONTENT_W - 60 * mm, 30 * mm, 30 * mm])]
    s.append(Paragraph("Inspection log", H2))
    s.append(_tbl([["ID", "Product", "Batch", "Status", "Score", "Defects", "Date (IST)"]] +
                  [[_esc(str(i.get("id") or "")[:8]), _esc((i.get("products") or {}).get("product_code"), 40), _esc(i.get("batch_number"), 40), _status(i.get("status")),
                    _esc(i.get("quality_score"), 8), _esc(i.get("defect_count")), _fmt_dt(i.get("created_at"))] for i in items],
                  [20 * mm, 32 * mm, 26 * mm, 20 * mm, 14 * mm, 16 * mm, CONTENT_W - 128 * mm]))
    return _doc(s, title)


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
