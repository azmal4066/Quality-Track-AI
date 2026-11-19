# QualityTrack AI

AI-powered industrial quality inspection: React + FastAPI + Ultralytics YOLO + Supabase.

## Build status (honest)

| Area | Status |
|---|---|
| Supabase schema, RLS, storage policies, hardening (migrations 0001-0004) | Applied to a live Supabase project and checked (tables, RLS, buckets). Seed is demo data, optional |
| FastAPI: auth (token verified by Supabase + role check), analyze, batch, history, detail, delete, products, defects, analytics, health, model status | Written, **not yet run end-to-end** |
| YOLO service + train/validate scripts | Written. **No weights included**. You must train them |
| Decision logic + 4 backend test files | Written, runnable with `pytest` |
| Frontend: auth pages, layout, dashboard, AI inspection, batch, products, defects, history, analytics | Written, **not yet compiled** (no npm access when generated). Expect small type fixes on first `npm run build` |
| Reports (PDF individual/batch/monthly + CSV), AI assistant (needs `AI_API_KEY` + `AI_MODEL`), employees (service-role user admin), settings (thresholds now read from DB, env is fallback) | Written, **not yet run or compiled** |
| Frontend unit tests (`npm test`, utils only), backend report/settings/decision tests | Written, **not yet run** |
| Deployment | **Not done / not verified** |

## 0. What still needs YOU
- Run `npm install && npm run build` and fix any type errors (code was never compiled here).
- Run `pytest` and exercise every endpoint with a real Supabase project.
- Train/provide YOLO weights (see `backend/ml/COLAB.md`); without them inspection returns 503 (by design).
- Notification settings are stored preferences only; no email/push sending exists.
- Rotate any keys that were ever pasted into chats or zips.

## Known limits (not built)
- Demo mode (`DEMO_MODE_ENABLED=true`, off by default) only draws a watermarked placeholder when weights are missing. It is clearly labeled, never saved, never counted in analytics.
- Batch now processes images one by one with a live progress bar (the old single-request `/batch` endpoint still exists).
- Frontend uses plain Tailwind components, not the shadcn/ui library.
- No component/E2E tests; only utility unit tests on the frontend.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor: run `supabase/migrations/0001` to `0004` in order. Optionally `seed.sql` (demo data only).
3. Auth > URL Configuration: add `http://localhost:5173` (and your Vercel URL later) as redirect URLs.
4. Register in the app, then promote yourself in SQL Editor:
   `update public.profiles set role='super_admin' where email='you@example.com';`
5. Copy the project URL, the publishable (anon) key and the secret (service-role) key from Project Settings > API Keys. The secret key goes only in `backend/.env`.

## 2. Backend
The env file must be named exactly `.env` (not `backend.env`) and live in `backend/`.
```bash
cp .env.example backend/.env      # fill in backend values
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload     # docs at http://localhost:8000/docs
```
Without weights, `/api/model/status` reports `available: false` and `/analyze` returns 503. It never invents detections.

## 3. Train the model
1. Get a labeled dataset (e.g. NEU-DET for steel surface defects, or your own labeled images) and convert to YOLO format under `backend/ml/datasets/defects/{images,labels}/{train,val,test}`.
2. Edit class `names` in `backend/ml/dataset.yaml` to match your labels.
3. Train (use a GPU, e.g. free Google Colab):
   `python ml/train.py --data ml/dataset.yaml --epochs 100 --version v1.0.0`
4. Evaluate: `python ml/validate.py`
5. Set `MODEL_VERSION=v1.0.0` in `backend/.env`. Weights land in `backend/ml/weights/best.pt`.
The app only shows classes your model was trained on.

## 4. Frontend
```bash
cp .env.example frontend/.env     # fill VITE_ values
cd frontend && npm install && npm run dev
```

## 5. Deploy
- Frontend: Vercel, root `frontend`, set the three `VITE_` vars (`vercel.json` handles SPA routing).
- Backend: Render/Railway using `backend/Dockerfile`; set backend env vars and `ALLOWED_ORIGINS` to your Vercel URL. Upload weights (volume or build step).
- Health check path: `/api/health`.

## Security notes
The service-role (secret) key only exists in the backend and is never committed (see `.gitignore`). RLS limits direct DB access; the backend re-checks roles on every sensitive route.
