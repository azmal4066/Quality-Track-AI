# Using QualityTrack AI on Android

The app is an installable web app (PWA). The YOLO model needs a server (torch cannot realistically run on a phone), so you host two things and open the site on your phone.

## A. Quick test on your home Wi-Fi (laptop runs everything)
1. Run backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000` and frontend with `npm run dev -- --host`.
2. Find laptop IP (e.g. 192.168.1.20). In `frontend/.env` set `VITE_API_URL=http://192.168.1.20:8000`, and in `backend/.env` set `ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.20:5173`. Restart both.
3. Phone on same Wi-Fi: open `http://192.168.1.20:5173` in Chrome. Camera capture and install need HTTPS, so this mode is for testing only.

## B. Real use anywhere (HTTPS)
1. Push the project to GitHub (`backend/ml/weights/best.pt` is allowed in .gitignore, ~6 MB).
2. Backend on Render: New > Blueprint > pick the repo (`render.yaml`). Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS (your Vercel URL). Free instances have limited RAM and may run out of memory loading YOLO; use a paid instance if it crashes.
3. Frontend on Vercel: import the repo, root directory `frontend`, env vars VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL (Render URL).
4. Supabase > Authentication > URL Configuration: add the Vercel URL.
5. Android Chrome: open the Vercel URL > menu (3 dots) > Add to Home screen / Install app.
6. AI Inspection > "Take photo with camera" opens the rear camera.

Nothing here has been deployed or tested by the assistant.
