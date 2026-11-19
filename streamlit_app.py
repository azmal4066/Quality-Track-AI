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


def login_view():
    st.title("🔍 QualityTrack AI")
    tab_in, tab_up = st.tabs(["Sign in", "Register"])
    with tab_in:
        with st.form("login"):
            email = st.text_input("Email")
            pw = st.text_input("Password", type="password")
            if st.form_submit_button("Sign in", type="primary"):
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
        with st.form("register"):
            name = st.text_input("Full name")
            email = st.text_input("Email", key="re")
            pw = st.text_input("Password (min 8)", type="password", key="rp")
            if st.form_submit_button("Create account"):
                if len(pw) < 8:
                    st.error("Password must be at least 8 characters.")
                else:
                    try:
                        anon_client().auth.sign_up({"email": email, "password": pw, "options": {"data": {"full_name": name}}})
                        st.success("Account created. Check your email if confirmation is on, then sign in. An admin must set your role.")
                    except Exception as e:
                        st.error(f"Could not register: {e}")


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
        st.warning(f"Your role is '{user.role}', which cannot run inspections. Ask an admin to change it to 'inspector' or 'admin' "
                   "(Supabase > SQL Editor > update public.profiles set role='admin' where email='<your email>'), then sign out and sign in again.")
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
        if defs:
            st.dataframe(pd.DataFrame(defs), hide_index=True)
        else:
            st.caption("No defects detected by the model.")


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
    if ms["available"]:
        st.success("Model loaded")
    else:
        st.error(f"Model unavailable: {ms['error']}")
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
