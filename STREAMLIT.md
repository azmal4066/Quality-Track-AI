# Deploy on Streamlit Community Cloud

Streamlit cannot host the React + FastAPI version. `streamlit_app.py` is a Streamlit edition that reuses the same
YOLO service, decision logic, Supabase database/storage and report builders (single app, no separate backend).
Included: sign in/register, AI Inspection (upload or phone camera), History, Defects, Analytics, Reports (PDF/CSV), model status.
Not included: Employees admin, Settings editor, Batch page, AI assistant (use the React app for those).

1. Push the whole project to a GitHub repo (`backend/ml/weights/best.pt` must be committed; `.gitignore` allows it).
2. share.streamlit.io > Create app > pick repo, branch, main file `streamlit_app.py`.
3. Advanced settings: Python 3.12 (or 3.11); Secrets: paste the values from `.streamlit/secrets.toml.example`.
4. Deploy. First build downloads torch (several minutes).
5. Supabase > Authentication > URL Configuration: add your `https://<app>.streamlit.app` URL.
6. Register in the app, then in Supabase SQL Editor: `update public.profiles set role='super_admin' where email='you@example.com';`
7. Android: open the app URL in Chrome > menu > Add to Home screen. The "Camera" source uses the phone camera.

Honest notes: not deployed or run by the assistant (no network or Streamlit install here). Free instances have limited memory;
torch + YOLO may be tight and the app can restart. The service-role key is only in Streamlit secrets (server side).
Apps on free tier sleep when idle.
