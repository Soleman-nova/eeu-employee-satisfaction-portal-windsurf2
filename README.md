# EEU Employee Satisfaction Portal

Collect anonymous employee feedback and allow HR/Admins to analyze satisfaction trends securely.

- Backend: Django REST Framework (JWT for Admin)
- Frontend: React + Vite + TailwindCSS
- Charts: Recharts
- Exports: Excel (openpyxl), PDF (reportlab)
- Docs: Swagger/OpenAPI via drf-spectacular at `/api/docs/`

---

## Prerequisites
- Python 3.12+
- Node.js 18+
- Git (optional)

---

## Quick Start (Development)

### 1) Backend
From repo root:

```powershell
# Create & activate venv (Windows PowerShell)
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# (Optional) Set up .env
copy backend\.env.example backend\.env

# Apply migrations
python backend\manage.py migrate

# Create an admin (already ensured in dev, safe to re-run)
python backend\manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); u,created=U.objects.get_or_create(username='admin', defaults={'is_staff':True,'is_superuser':True}); u.is_staff=True; u.is_superuser=True; u.set_password('Selamu@12345'); u.save(); print('OK')"

# Run server
python backend\manage.py runserver
```

Backend runs at: http://localhost:8000

### 2) Frontend
In another terminal:

```powershell
# Install deps
cd frontend
npm install

# (Optional) Set up .env
copy .env.example .env
# Ensure VITE_API_BASE_URL matches backend origin
# e.g. VITE_API_BASE_URL=http://localhost:8000

# Start Vite dev server
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Environment Variables

### backend/.env.example
```env
# Django
SECRET_KEY=dev-secret-change-me
DEBUG=1
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (choose one)
# For SQLite (default) leave empty
# For Postgres/MySQL, set DATABASE_URL (requires dj-database-url if adopted)
# DATABASE_URL=postgres://user:pass@localhost:5432/eeu

# CORS
CORS_ALLOW_ALL_ORIGINS=1
# or strict whitelist: CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### frontend/.env.example
```env
# API base URL (no trailing slash)
VITE_API_BASE_URL=http://localhost:8000
```

---

## Flows

### Public (anonymous)
- `GET /api/survey/active/` → fetch active survey
- Complete Likert (1–5) + text questions
- `POST /api/survey/submit/` → submit responses anonymously
- Thank-you page confirmation

### Admin
- Login at frontend `/admin/login` (JWT stored in localStorage)
- Dashboard `/admin/dashboard` shows:
  - Totals, average ratings, responses over time, rating distributions
- Manage Surveys `/admin/manage-surveys`:
  - Create survey, add rating/text questions
  - Edit survey with nested question add/update/remove
  - Activate one survey at a time
- Responses `/admin/responses`:
  - Filter by date range, survey, question, rating min/max
  - Paginated table
  - Export Excel/PDF with current filters

---

## API Endpoints (Selected)

- Auth
  - `POST /api/admin/login/` — Admin login (JWT)

- Dashboard
  - `GET /api/admin/dashboard/` — Aggregates, timeseries, distributions

- Surveys (Admin)
  - `GET /api/admin/surveys/` — List
  - `POST /api/admin/surveys/` — Create
  - `PATCH /api/admin/surveys/:id/` — Update (questions are replace-all: omitted IDs are deleted, entries without `id` are created)
  - `POST /api/admin/surveys/:id/activate/` — Activate survey
  - Aliases (spec wording):
    - `POST /api/admin/survey/create/` → alias for create

- Responses (Admin)
  - `GET /api/admin/responses/` — List (filters: `survey`, `from`, `to`, `question`, `rating_min`, `rating_max`, `page`, `page_size`)
  - `GET /api/admin/responses/export.xlsx` — Export Excel (same filters)
  - `GET /api/admin/responses/export.pdf` — Export PDF (same filters)
  - Alias (spec wording):
    - `GET /api/admin/survey/responses/` → alias for list

- Public Survey
  - `GET /api/survey/active/`
  - `POST /api/survey/submit/`

Full interactive docs: http://localhost:8000/api/docs/

---

## Commands

### Backend (from repo root)
```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Migrate
python backend\manage.py migrate

# Runserver
autoreload: python backend\manage.py runserver

# Create superuser (interactive)
python backend\manage.py createsuperuser

# Lint/format (optional if configured)
```

### Frontend
```powershell
cd frontend
npm run dev
npm run build
npm run preview
```

---

## Exports
- Excel: Styled header (teal) + auto column widths (openpyxl)
- PDF: Landscape A4 table with alternating row colors (reportlab)
- Ensure `openpyxl` and `reportlab` are installed (included in `backend/requirements.txt`).

---

## Troubleshooting
- 401 on admin endpoints → login at `/admin/login` and ensure `eeu_admin_token` exists in localStorage.
- CORS errors → set `VITE_API_BASE_URL` to backend origin and configure CORS in backend `.env`.
- No charts / empty dashboard → ensure there is an active survey and submitted responses.
- Exports download empty → confirm database has data and filters aren’t too restrictive.

---

## Licensing & Attribution
Internal tool for Ethiopian Electric Utility (EEU). Include proper attribution for icons/logos as needed.
