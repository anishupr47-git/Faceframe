# FaceFrame MVP

FaceFrame is a one-page React app for browser-based face analysis and hairstyle recommendations.
This repo is ready for local use and cPanel deployment (frontend + backend).

## Stack
- Frontend: React + Vite, Framer Motion, react-icons, MediaPipe Face Landmarker
- ML: Python, pandas, scikit-learn, openpyxl, joblib
- API options:
  - Local dev: FastAPI via `ml/infer.py --serve`
  - cPanel hosting: Flask WSGI app via `ml/cpanel_api.py` + `passenger_wsgi.py`

## Project structure
```text
faceframe/
  public/
    .htaccess
    *.png
  src/
    components/
    sections/
    services/
    utils/
    styles/
  ml/
    data/
    saved_model/
    train_model.py
    infer.py
    cpanel_api.py
    requirements.txt
  passenger_wsgi.py
  .env.example
```

## 1) Frontend local setup
```bash
npm install
npm run dev
```
App runs on `http://localhost:5173`.

## 2) Dataset and model training
Put dataset at:
`ml/data/hairstyle_recommender_starter_dataset.xlsx`

If your file is elsewhere, copy it:
```powershell
Copy-Item "d:\Downloads\haircut.xlsx" "d:\Documents\MLDL\ml\data\hairstyle_recommender_starter_dataset.xlsx" -Force
```

Train model:
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r ml/requirements.txt
python ml/train_model.py
```

Expected artifact:
`ml/saved_model/faceframe_model.joblib`

## 3) API local setup (FastAPI)
```bash
python ml/infer.py --serve
```

Endpoints:
- `GET /health`
- `POST /recommend`

Optional CORS env for local FastAPI:
```bash
# comma-separated
set FACEFRAME_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## 4) Frontend API config (important for production)
Create `.env` from `.env.example`:
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_API_RECOMMEND_PATH=/recommend
VITE_ENABLE_MOCK_FALLBACK=false
```

Notes:
- In dev, frontend defaults to `http://127.0.0.1:8000/recommend`.
- In production, set real API URL.

## 5) cPanel frontend deployment (React build)
1. Set production env (`.env`) with your API URL.
2. Build frontend:
   ```bash
   npm run build
   ```
3. Upload contents of `dist/` into cPanel `public_html/` (or target domain doc root).
4. Ensure `.htaccess` from build root is uploaded (comes from `public/.htaccess`).
5. Open your domain and verify app loads.

## 6) cPanel backend deployment (Python app)
Recommended: host backend on subdomain, e.g. `api.yourdomain.com`.

1. Upload backend code (at minimum `ml/`, `passenger_wsgi.py`) to server path, e.g.:
   `/home/USERNAME/faceframe-backend`
2. In cPanel: **Setup Python App**
   - Python version: 3.10+ (or highest available)
   - Application root: `faceframe-backend`
   - Application URL: `/` (or subpath)
   - Startup file: `passenger_wsgi.py`
   - Entry point: `application`
3. Open app terminal / virtualenv and install deps:
   ```bash
   pip install -r ml/requirements.txt
   ```
4. Make sure model file exists on server:
   `ml/saved_model/faceframe_model.joblib`
   (train locally and upload, or train on server)
5. Set environment variables in Python App:
   - `FACEFRAME_MODEL_PATH=/home/USERNAME/faceframe-backend/ml/saved_model/faceframe_model.joblib`
   - `FACEFRAME_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
6. Restart Python app from cPanel.
7. Validate:
   - `https://api.yourdomain.com/health`
   - `POST https://api.yourdomain.com/recommend`

## 7) cPanel smoke test checklist
- Frontend opens at your domain.
- Recommendation request returns `source: "api"` (not mock).
- Browser console has no CORS errors.
- `health` endpoint returns `status: ok`.

## Camera and analysis notes
- Camera opens only when user starts it and stops when user stops it or leaves component.
- UI handles: no face, low confidence (`closest match`), camera denied, multiple faces.
- Raw geometry stays internal; UI only shows readable labels.

## Calibration TODO
Face-shape thresholds in `src/utils/faceAnalysis.js` are starter heuristics and should be calibrated with real production feedback.
