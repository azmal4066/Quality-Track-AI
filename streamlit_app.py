"""QualityTrack AI: Streamlit edition (single app, no separate backend).
Reuses the backend's real YOLO service, decision logic, Supabase client and report builders.
Auth: Supabase email/password. Authorization is checked in Python against `profiles` (service-role key stays server-side)."""
import os
import sys
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "backend"))
for k, default in (("SUPABASE_URL", None), ("SUPABASE_SERVICE_ROLE_KEY", None),
                   ("YOLO_MODEL_PATH", str(ROOT / "backend/ml/weights/best.pt")), ("MODEL_VERSION", "v1.0.0")):
    try:
        v = st.secrets.get(k, default)
    except Exception:
        v = default
    if v:
        os.environ.setdefault(k, str(v))

import pandas as pd  # noqa: E402
from supabase import create_client  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from app.core.security import CurrentUser  # noqa: E402
from app.services.supabase_client import get_supabase, signed_url  # noqa: E402
from app.services.yolo_service import yolo_service  # noqa: E402
from app.api.inspection import run_one, ALLOWED, MAGIC  # noqa: E402
from app.api import reports as rp  # noqa: E402

st.set_page_config(page_title="QualityTrack AI", page_icon="🔍", layout="wide")
STAFF, ADMIN = {"super_admin", "admin", "inspector"}, {"super_admin", "admin"}
MAX_MB = 10


@st.cache_resource
def anon_client():
    return create_client(os.environ["SUPABASE_URL"], st.secrets["SUPABASE_ANON_KEY"])


@st.cache_resource(show_spinner="Loading AI model...")
def model_status():
    return yolo_service.status()


def _compact(html: str) -> str:
    """Streamlit's markdown turns indented / blank-line HTML into code blocks, so flatten it first."""
    return "".join(line.strip() for line in html.splitlines())


LOGIN_CSS = _compact("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
.stApp, .stApp * { font-family: 'Manrope', system-ui, sans-serif; }
.stApp { background: #080D16; }
[data-testid="stSidebar"], [data-testid="stHeader"], [data-testid="stToolbar"], footer { display: none !important; }
.block-container { max-width: 1180px; padding-top: 2.2rem; padding-bottom: 2rem; }

.qt-brand { display: flex; align-items: center; gap: 12px; }
.qt-logo { width: 40px; height: 40px; border-radius: 12px; background: #3B82F6; display: grid; place-items: center;
  color: #fff; font-weight: 800; font-size: 15px; letter-spacing: -.5px; box-shadow: 0 0 0 1px rgba(59,130,246,.35), 0 8px 30px -8px rgba(59,130,246,.45); }
.qt-name { font-size: 20px; font-weight: 800; color: #F8FAFC; letter-spacing: -.3px; }
.qt-name span { color: #06B6D4; }

.qt-hero { position: relative; padding: 6px 8px 0 0; }
.qt-hero h2 { font-size: 38px; line-height: 1.1; font-weight: 800; letter-spacing: -1px; color: #F8FAFC; margin: 30px 0 0; padding: 0; max-width: 460px; }
.qt-hero h2 span { background: linear-gradient(90deg, #3B82F6, #06B6D4); -webkit-background-clip: text; background-clip: text; color: transparent; }
.qt-feat { display: flex; gap: 14px; margin-top: 18px; max-width: 460px; }
.qt-feat i { flex: none; width: 38px; height: 38px; border-radius: 12px; border: 1px solid #26344A; background: #121C2B; display: grid; place-items: center; font-style: normal; font-size: 16px; }
.qt-feat b { display: block; color: #F8FAFC; font-size: 14px; font-weight: 700; }
.qt-feat p { margin: 2px 0 0; color: #94A3B8; font-size: 13.5px; line-height: 1.45; }
.qt-note { margin-top: 28px; color: #94A3B8; font-size: 12px; max-width: 460px; }

.qt-frame { margin-top: 30px; max-width: 460px; border: 1px solid #26344A; border-radius: 16px; background: #121C2B; overflow: hidden;
  box-shadow: 0 20px 50px -20px rgba(59,130,246,.35); }
.qt-bar { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #26344A; font: 600 11px 'JetBrains Mono', monospace; color: #94A3B8; }
.qt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22C55E; margin-right: 8px; animation: qt-blink 1.6s ease-in-out infinite; }
.qt-view { position: relative; height: 210px; background-color: #0B1320; overflow: hidden;
  background-image: linear-gradient(#26344A55 1px, transparent 1px), linear-gradient(90deg, #26344A55 1px, transparent 1px); background-size: 24px 24px; }
.qt-plate { position: absolute; inset: 24px; border: 1px solid #26344A; border-radius: 12px; background: linear-gradient(135deg, #26344A99, #26344A44, #26344A99); }
.qt-box { position: absolute; border-width: 2px; border-style: solid; border-radius: 6px; animation: qt-pop 5s ease-in-out infinite; }
.qt-box em { position: absolute; top: -24px; left: 0; padding: 2px 8px; border-radius: 4px; font: 600 11px 'JetBrains Mono', monospace; font-style: normal; white-space: nowrap; }
.qt-b1 { left: 16%; top: 24%; width: 26%; height: 44%; border-color: #EF4444; } .qt-b1 em { background: #EF4444; color: #fff; }
.qt-b2 { right: 10%; bottom: 14%; width: 28%; height: 18%; border-color: #F59E0B; animation-delay: 1.2s; } .qt-b2 em { background: #F59E0B; color: #000; }
.qt-scan { position: absolute; left: 0; right: 0; top: 0; height: 100%; animation: qt-scan 4.5s ease-in-out infinite; }
.qt-scan:before { content: ''; position: absolute; left: 0; right: 0; top: -40px; height: 40px; background: linear-gradient(to bottom, transparent, rgba(6,182,212,.22)); }
.qt-scan:after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #06B6D4; box-shadow: 0 0 14px 2px rgba(6,182,212,.7); }
.qt-foot { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; color: #94A3B8; font-size: 12px; }
.qt-chip { background: rgba(239,68,68,.15); color: #EF4444; font-weight: 800; border-radius: 8px; padding: 4px 10px; margin-right: 8px; }
@keyframes qt-scan { 0% { transform: translateY(-2%); } 50% { transform: translateY(98%); } 100% { transform: translateY(-2%); } }
@keyframes qt-pop { 0%, 12% { opacity: 0; transform: scale(.92); } 22%, 80% { opacity: 1; transform: scale(1); } 92%, 100% { opacity: 0; } }
@keyframes qt-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes qt-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

.qt-head { animation: qt-in .45s ease-out both; margin-top: 6px; }
.qt-head h1 { color: #F8FAFC; font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin: 0; padding: 0; }
.qt-head p { color: #94A3B8; font-size: 14px; margin: 6px 0 14px; }
.qt-mobile { display: none; margin-bottom: 18px; }

.stTabs [data-baseweb="tab-list"] { gap: 4px; padding: 4px; background: #0D1421; border: 1px solid #26344A; border-radius: 12px; }
.stTabs [data-baseweb="tab"] { flex: 1; justify-content: center; height: 40px; border-radius: 9px; color: #94A3B8; font-weight: 700; }
.stTabs [aria-selected="true"] { background: rgba(59,130,246,.16); color: #3B82F6; }
.stTabs [data-baseweb="tab-highlight"], .stTabs [data-baseweb="tab-border"] { display: none; }

[data-testid="stForm"] { background: #121C2B; border: 1px solid #26344A; border-radius: 16px; padding: 26px 24px 22px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,.5); animation: qt-in .45s ease-out both; }
[data-testid="stForm"] label p { font-size: 12px; font-weight: 700; color: #94A3B8; }
[data-baseweb="input"], [data-baseweb="base-input"] { border-radius: 12px !important; background: #080D16 !important; }
[data-baseweb="input"] { border: 1px solid #26344A !important; transition: border-color .15s, box-shadow .15s; }
[data-baseweb="input"]:focus-within { border-color: #3B82F6 !important; box-shadow: 0 0 0 4px rgba(59,130,246,.15); }
[data-baseweb="input"] input { padding: 12px 14px !important; color: #F8FAFC; }
[data-baseweb="input"] input::placeholder { color: #64748B; }
[data-testid="stFormSubmitButton"] button { width: 100%; height: 46px; margin-top: 6px; border: 0; border-radius: 12px; font-weight: 800; font-size: 15px;
  color: #fff; background: linear-gradient(135deg, #3B82F6, #2563EB); box-shadow: 0 0 0 1px rgba(59,130,246,.35), 0 10px 30px -10px rgba(59,130,246,.6);
  transition: transform .12s, filter .12s; }
[data-testid="stFormSubmitButton"] button:hover { filter: brightness(1.1); transform: translateY(-1px); color: #fff; }
[data-testid="stFormSubmitButton"] button:active { transform: translateY(0); }
[data-testid="stAlert"] { border-radius: 12px; }
.qt-hint { display: flex; gap: 10px; align-items: flex-start; margin: 4px 0 6px; padding: 10px 12px; border: 1px solid #26344A; border-radius: 12px; background: #0B1320; color: #94A3B8; font-size: 12.5px; }
.qt-hint b { color: #F8FAFC; }
.qt-foot2 { text-align: center; color: #64748B; font-size: 12px; margin-top: 18px; }

@media (max-width: 900px) { .qt-hero { display: none; } .qt-mobile { display: block; } .block-container { padding-top: 1.2rem; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
""")

LOGIN_HERO = _compact("""
<div class="qt-hero">
  <div class="qt-brand"><div class="qt-logo">QT</div><div class="qt-name">QualityTrack<span> AI</span></div></div>
  <div class="qt-frame">
    <div class="qt-bar"><div><span class="qt-dot"></span>LIVE &middot; YOLO</div><div>unit #0482</div></div>
    <div class="qt-view">
      <div class="qt-plate"></div>
      <div class="qt-box qt-b1"><em>crack 0.91</em></div>
      <div class="qt-box qt-b2"><em>scratch 0.54</em></div>
      <div class="qt-scan"></div>
    </div>
    <div class="qt-foot"><div><span class="qt-chip">FAIL</span>2 defects found</div><div style="font-family:'JetBrains Mono',monospace">38 ms</div></div>
  </div>
  <h2>Every product inspected. <span>Every defect traced.</span></h2>
  <div class="qt-feat"><i>🔍</i><div><b>AI inspection</b><p>Upload an image or use the camera and get defects with confidence scores.</p></div></div>
  <div class="qt-feat"><i>🐞</i><div><b>Defect tracking</b><p>Review and resolve defects in one place.</p></div></div>
  <div class="qt-feat"><i>📊</i><div><b>Quality analytics</b><p>Trends and PDF / CSV reports for every batch.</p></div></div>
  <p class="qt-note">Illustration only. Real detections come from your trained YOLO model.</p>
</div>
""")

MOBILE_BRAND = _compact("""
<div class="qt-mobile"><div class="qt-brand"><div class="qt-logo">QT</div><div class="qt-name">QualityTrack<span> AI</span></div></div></div>
""")


def login_view():
    st.markdown(LOGIN_CSS, unsafe_allow_html=True)
    left, right = st.columns([1.1, 1], gap="large")
    with left:
        st.markdown(LOGIN_HERO, unsafe_allow_html=True)
    with right:
        st.markdown(MOBILE_BRAND, unsafe_allow_html=True)
        tab_in, tab_up = st.tabs(["Sign in", "Create account"])
        with tab_in:
            st.markdown('<div class="qt-head"><h1>Welcome back</h1><p>Sign in to your QualityTrack account.</p></div>', unsafe_allow_html=True)
            with st.form("login"):
                email = st.text_input("Email", placeholder="you@company.com")
                pw = st.text_input("Password", type="password", placeholder="Enter your password")
                if st.form_submit_button("Sign in  →", type="primary"):
                    try:
                        r = anon_client().auth.sign_in_with_password({"email": email, "password": pw})
                        prof = get_supabase().table("profiles").select("role,is_active,full_name").eq("id", r.user.id).single().execute().data
                        if not prof or not prof["is_active"]:
                            st.error("Account inactive or not found.")
                        else:
                            st.session_state.user = CurrentUser(id=r.user.id, email=email, role=prof["role"])
                            st.session_state.name = prof.get("full_name") or email
                            st.rerun()
                    except Exception:
                        st.error("Sign in failed. Check email/password (and confirm your email if required).")
        with tab_up:
            st.markdown('<div class="qt-head"><h1>Create account</h1><p>Join your team on QualityTrack AI.</p></div>', unsafe_allow_html=True)
            with st.form("register"):
                name = st.text_input("Full name", placeholder="Your full name")
                email = st.text_input("Email", key="re", placeholder="you@company.com")
                pw = st.text_input("Password (min 8)", type="password", key="rp", placeholder="At least 8 characters")
                st.markdown('<div class="qt-hint">ℹ️<div>New accounts start as <b>Viewer</b>. An admin assigns your role.</div></div>', unsafe_allow_html=True)
                if st.form_submit_button("Create account  →", type="primary"):
                    if len(pw) < 8:
                        st.error("Password must be at least 8 characters.")
                    else:
                        try:
                            anon_client().auth.sign_up({"email": email, "password": pw, "options": {"data": {"full_name": name}}})
                            st.success("Account created. Check your email if confirmation is on, then sign in. An admin must set your role.")
                        except Exception as e:
                            st.error(f"Could not register: {e}")
        st.markdown('<div class="qt-foot2">Protected by Supabase Auth · QualityTrack AI</div>', unsafe_allow_html=True)


def sign_url(bucket, path):
    try:
        return signed_url(bucket, path)
    except Exception:
        return None


def page_inspect(user):
    st.header("AI Inspection")
    ms = model_status()
    if not ms["available"]:
        st.error(f"AI model unavailable. {ms['error']} {ms['setup_hint']}")
        return
    if user.role not in STAFF:
        st.warning("Your role cannot run inspections.")
        return
    st.caption(f"Model {ms['model_version']} · classes: {', '.join(ms['classes'])}")
    cats = (get_supabase().table("settings").select("value").eq("key", "product_categories").execute().data or [{"value": []}])[0]["value"]
    c1, c2 = st.columns(2)
    code = c1.text_input("Product ID")
    batch = c2.text_input("Batch number")
    c1.selectbox("Product category", [""] + cats, key="cat")
    notes = st.text_area("Description (optional)", height=70)
    src = st.radio("Image source", ["Upload", "Camera"], horizontal=True)
    f = st.file_uploader("Image (JPG, PNG, WEBP)", type=["jpg", "jpeg", "png", "webp"]) if src == "Upload" else st.camera_input("Take photo")
    if f and st.button("Start AI inspection", type="primary"):
        data = f.getvalue()
        if len(data) > MAX_MB * 1024 * 1024:
            st.error(f"File exceeds {MAX_MB} MB")
        elif f.type not in ALLOWED or not data.startswith(MAGIC):
            st.error("Only JPG, PNG or WEBP images are supported.")
        else:
            with st.spinner("Running YOLO..."):
                try:
                    r = run_one(data, f.type, user, code or None, batch or None, notes or None)
                except HTTPException as e:
                    st.error(e.detail["message"] if isinstance(e.detail, dict) else e.detail)
                    return
                except Exception as e:
                    st.error(f"Inspection failed: {e}")
                    return
            color = {"PASS": "green", "FAIL": "red", "REVIEW": "orange"}[r["status"]]
            st.markdown(f"### Result: :{color}[{r['status']}]")
            m1, m2, m3 = st.columns(3)
            m1.metric("Defects", r["defect_count"])
            m2.metric("Top model confidence", f"{r['max_confidence']:.2f}" if r["max_confidence"] else "-")
            m3.metric("Quality score (derived, 0-100)", r["quality_score"])
            a, b = st.columns(2)
            a.image(r["original_url"], caption="Original")
            b.image(r["annotated_url"], caption="Annotated")
            if r["detections"]:
                st.dataframe(pd.DataFrame(r["detections"]), hide_index=True)
            st.caption(f"Inspection ID {r['id']} saved. Model confidence and quality score are different measures.")


def inspections_df(limit=500):
    rows = get_supabase().table("inspections").select("*, products(product_code,name,category)").order("created_at", desc=True).limit(limit).execute().data
    df = pd.DataFrame(rows)
    if not df.empty:
        df["product"] = df["products"].apply(lambda p: (p or {}).get("product_code"))
        df["category"] = df["products"].apply(lambda p: (p or {}).get("category") or "Unlinked")
        df["created_at"] = pd.to_datetime(df["created_at"])
    return df


def page_history(user):
    st.header("Inspection History")
    df = inspections_df()
    if df.empty:
        st.info("No inspections yet.")
        return
    c1, c2, c3 = st.columns(3)
    status = c1.multiselect("Status", ["PASS", "FAIL", "REVIEW"])
    batch = c2.text_input("Batch contains")
    prod = c3.text_input("Product ID contains")
    if status: df = df[df["status"].isin(status)]
    if batch: df = df[df["batch_number"].fillna("").str.contains(batch, case=False)]
    if prod: df = df[df["product"].fillna("").str.contains(prod, case=False)]
    st.dataframe(df[["created_at", "product", "batch_number", "status", "defect_count", "quality_score", "max_confidence", "id"]], hide_index=True)
    if len(df):
        pick = st.selectbox("Open inspection", df["id"], format_func=lambda i: f"{i[:8]} · {df[df['id'] == i]['status'].iloc[0]}")
        row = df[df["id"] == pick].iloc[0]
        a, b = st.columns(2)
        a.image(sign_url("inspection-images", row["original_image_url"]) or "", caption="Original")
        b.image(sign_url("annotated-images", row["annotated_image_url"]) or "", caption="Annotated")
        defs = get_supabase().table("defects").select("defect_type,severity,confidence,status,corrective_action").eq("inspection_id", pick).execute().data
        st.dataframe(pd.DataFrame(defs), hide_index=True) if defs else st.caption("No defects detected by the model.")


def page_defects(user):
    st.header("Defect Management")
    q = st.selectbox("Status filter", ["All", "open", "under_review", "resolved", "closed"])
    qry = get_supabase().table("defects").select("*").order("created_at", desc=True).limit(200)
    if q != "All": qry = qry.eq("status", q)
    rows = qry.execute().data
    if not rows:
        st.info("No defects.")
        return
    df = pd.DataFrame(rows)
    st.dataframe(df[["created_at", "defect_type", "severity", "confidence", "status", "corrective_action", "id"]], hide_index=True)
    if user.role in STAFF:
        with st.form("upd"):
            did = st.selectbox("Defect", df["id"], format_func=lambda i: f"{i[:8]} · {df[df['id'] == i]['defect_type'].iloc[0]}")
            ns = st.selectbox("New status", ["open", "under_review", "resolved", "closed"])
            ca = st.text_area("Corrective action")
            if st.form_submit_button("Update"):
                patch = {"status": ns}
                if ca: patch["corrective_action"] = ca
                get_supabase().table("defects").update(patch).eq("id", did).execute()
                st.success("Updated")
                st.rerun()


def page_analytics(user):
    st.header("Quality Analytics")
    df = inspections_df(2000)
    if df.empty:
        st.info("No data yet.")
        return
    total = len(df)
    c = st.columns(4)
    c[0].metric("Inspections", total)
    c[1].metric("Pass rate", f"{100 * (df['status'] == 'PASS').mean():.1f}%")
    c[2].metric("Fail rate", f"{100 * (df['status'] == 'FAIL').mean():.1f}%")
    c[3].metric("Avg quality score (derived)", f"{df['quality_score'].astype(float).mean():.1f}")
    df["month"] = df["created_at"].dt.strftime("%Y-%m")
    st.subheader("Monthly trend")
    st.bar_chart(df.groupby(["month", "status"]).size().unstack(fill_value=0))
    st.subheader("Product category performance")
    st.bar_chart(df.groupby(["category", "status"]).size().unstack(fill_value=0))
    st.subheader("Batch-wise comparison")
    st.bar_chart(df.assign(batch=df["batch_number"].fillna("No batch")).groupby(["batch", "status"]).size().unstack(fill_value=0))
    defs = pd.DataFrame(get_supabase().table("defects").select("defect_type,severity").limit(5000).execute().data)
    if not defs.empty:
        a, b = st.columns(2)
        a.subheader("Defect frequency"); a.bar_chart(defs["defect_type"].value_counts())
        b.subheader("Severity distribution"); b.bar_chart(defs["severity"].value_counts())


def page_reports(user):
    st.header("Reports")
    if user.role not in STAFF:
        st.warning("Your role cannot generate reports.")
        return
    df = inspections_df()
    if df.empty:
        st.info("No inspections yet.")
        return
    pick = st.selectbox("Inspection", df["id"], format_func=lambda i: f"{i[:8]} · {df[df['id'] == i]['status'].iloc[0]}")
    if st.button("Build inspection PDF"):
        st.session_state.pdf = (f"inspection-{pick[:8]}.pdf", rp.inspection_pdf(pick))
    month = st.text_input("Month (YYYY-MM) for monthly report / CSV", value=pd.Timestamp.now().strftime("%Y-%m"))
    if st.button("Build monthly PDF"):
        items = rp._list(month=month)
        st.session_state.pdf = (f"monthly-{month}.pdf", rp.summary_pdf(f"Monthly quality report {month}", items)) if items else None
        if not items: st.warning("No inspections that month.")
    batches = sorted({b for b in df["batch_number"].dropna()})
    if batches:
        bn = st.selectbox("Batch", batches)
        if st.button("Build batch PDF"):
            st.session_state.pdf = (f"batch-{bn}.pdf", rp.summary_pdf(f"Batch report {bn}", rp._list(batch=bn)))
    if st.session_state.get("pdf"):
        name, data = st.session_state.pdf
        st.download_button(f"Download {name}", data, file_name=name, mime="application/pdf")
    st.download_button("Download all inspections CSV", rp.csv_bytes(rp._list()), file_name="inspections.csv", mime="text/csv")


def page_model(user):
    st.header("AI model status")
    ms = model_status()
    st.success("Model loaded") if ms["available"] else st.error(f"Model unavailable: {ms['error']}")
    st.json(ms)


PAGES = {"AI Inspection": page_inspect, "Inspection History": page_history, "Defects": page_defects,
         "Analytics": page_analytics, "Reports": page_reports, "AI Model": page_model}

user = st.session_state.get("user")
if not user:
    login_view()
else:
    with st.sidebar:
        st.markdown(f"**{st.session_state.name}**  \n`{user.role}`")
        page = st.radio("Navigate", list(PAGES))
        if st.button("Sign out"):
            st.session_state.clear()
            st.rerun()
    PAGES[page](user)
