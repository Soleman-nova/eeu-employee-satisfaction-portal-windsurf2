# EEU Employee Survey Portal

A full-stack application for designing, distributing, and analyzing employee surveys. The system provides a public survey experience and an admin portal for survey management, analytics, response exports, and user administration.

---

## Architecture Overview

- Backend
  - Django 5 + Django REST Framework
  - JWT auth (djangorestframework-simplejwt)
  - OpenAPI docs (drf-spectacular)
  - PostgreSQL (recommended) or SQLite (dev only)
- Frontend
  - React + TypeScript (Vite/CRA depending on setup)
  - TailwindCSS for styling
- Key Apps / Modules
  - surveys: Survey, Section, Question, Response, Answer, SurveyAttempt
  - accounts: Admin login, dashboard analytics, responses API, user management

### Data Model (simplified)
- Survey
  - title, description, language (en/am), budget_year, is_active, created_at
- Section
  - survey (FK), title, description, order
- Question
  - survey (FK), section (nullable FK), text, question_type, options/labels, order, required
- Response
  - survey (FK), submitted_at, employee_identifier (optional)
- Answer
  - response (FK), question (FK), rating/comment/choice
- SurveyAttempt
  - fingerprint_hash (PK), attempts, last_submitted (rate limiting / anti-spam)

### Roles & Permissions (Admin Portal)
- super_admin: full access; JWT login allowed
- survey_designer: manage surveys; JWT login allowed
- viewer: read-only analytics; JWT login allowed

---

## Setup & Configuration

### Prerequisites
- Python 3.11+ (Windows: `py -3`)
- Node.js 18+ (for frontend)
- PostgreSQL 14+ (recommended)

### Backend setup
1) Install dependencies
- `py -m pip install -r backend/requirements.txt`

2) Configure database (backend/config/settings.py)
- Example (PostgreSQL):
  - ENGINE: `django.db.backends.postgresql_psycopg2`
  - NAME: `eeu_survey`
  - USER / PASSWORD / HOST / PORT: set appropriately

3) Apply migrations
- `py -3 manage.py migrate` (from `backend/`)

4) Create a superuser (optional if not loading a fixture)
- `py -3 manage.py createsuperuser`

5) Run backend
- `py -3 manage.py runserver`
- Open API docs: `http://localhost:8000/api/docs/`

### Frontend setup
- From `frontend/`:
  - `npm install`
  - `npm run dev` (or `npm run build && npm run preview`)

### Switching from SQLite to PostgreSQL (reference)
- Dump data from SQLite (done once):
  - `py -3 manage.py dumpdata --indent 2 --natural-foreign --natural-primary auth.user auth.group surveys --exclude contenttypes --exclude auth.permission --exclude admin.logentry --exclude sessions --output dumpfile.json`
- Update DB settings to PostgreSQL
- Migrate: `py -3 manage.py migrate`
- Load: `py -3 manage.py loaddata dumpfile.json`
- Reset sequences (to avoid PK conflicts): via Django shell
  - `py -3 manage.py shell` then:
    ```python
    from django.db import connection
    from django.core.management.color import no_style
    from django.apps import apps
    style = no_style()
    models = list(apps.get_app_config('auth').get_models()) + list(apps.get_app_config('surveys').get_models())
    for s in connection.ops.sequence_reset_sql(style, models):
        with connection.cursor() as c:
            c.execute(s)
    ```

---

## Features: Step-by-Step Guides

### 1) Admin Login
- Endpoint: `POST /api/admin/login/` (returns JWT access/refresh)
- Frontend: use login page to authenticate
- All three roles can log in; permissions restrict access within the portal

### 2) Admin Dashboard (Analytics)
- Endpoint: `GET /api/admin/dashboard/`
- Filters
  - survey: select a specific survey (ID)
  - q (name search) and budget_year (via the survey selector fetch)
  - region: filter responses by selected region answer
  - from/to: limit metrics to a date range (inclusive)
- What you see
  - Totals: number of responses
  - Averages: mean rating per rating-type question
  - Recent: 10 most recent responses
  - Timeseries: daily response counts (last 14 days; respects date filters)
  - Distributions: rating breakdowns (1..5) per question and per section
  - Demographics: gender, age, education (auto-detected by question text)
- Steps
  1. Open Dashboard in admin portal
  2. Type a survey name (q) and/or set budget_year to narrow survey options
  3. Choose a specific survey from the dropdown
  4. Optionally set region and date range
  5. Charts/cards update automatically

### 3) Manage Surveys
- Endpoints
  - `GET/POST /api/admin/surveys/`
  - `GET/PATCH/DELETE /api/admin/surveys/{id}/`
  - `POST /api/admin/surveys/{id}/activate/`
- Create a survey
  1. Click “New Survey”
  2. Enter title, description, language, budget_year
  3. Add sections and questions (rating, text, regions, dropdown, multiple_choice, linear_scale)
  4. Save
- Edit a survey
  1. Click “Edit” on a survey
  2. Modify fields, sections, or questions
  3. Save
- Activate a survey
  1. Click “Activate” for the survey to make it the active public survey

### 4) Responses: Listing & Exporting
- List
  - Endpoint: `GET /api/admin/responses/`
  - Filters: `survey`, `from`, `to`, `question`, `rating_min`, `rating_max`, pagination
- Exports
  - Excel: `GET /api/admin/responses/export.xlsx` (same filters)
  - PDF: `GET /api/admin/responses/export.pdf` (same filters)
- Steps
  1. Open Responses page
  2. Choose filters (survey/date/question/rating range)
  3. View paginated results
  4. Export as needed to XLSX/PDF

### 5) User Management
- Endpoints
  - `GET/POST /api/admin/users/`
  - `GET/PATCH/DELETE /api/admin/users/{id}/`
  - `POST /api/admin/users/{id}/reset-password/`
  - `POST /api/admin/change-password/` (self-service)
- Actions
  - Create admin users with roles (super_admin, survey_designer, viewer)
  - Edit username/role; Delete users (prevent self-deletion)
  - Reset password for another user; Change own password
- Steps
  1. Open “Users” page
  2. Create/edit/delete as needed
  3. Use “Reset Password” for another user or “Change Password” for self

### 6) Public Survey (Respondents)
- Endpoints (surveys app public)
  - Typically: `GET /api/surveys/active/` to fetch the active survey
  - `POST /api/surveys/submit/` to submit responses
- Steps (frontend)
  1. Open survey link
  2. Complete sections and questions
  3. Submit; data stored as Responses/Answers

---

## API Map (Admin)
- `POST /api/admin/login/`
- `POST /api/admin/token/refresh/`
- `GET /api/admin/dashboard/`
- `GET/POST /api/admin/surveys/`
- `GET/PATCH/DELETE /api/admin/surveys/{id}/`
- `POST /api/admin/surveys/{id}/activate/`
- `GET /api/admin/responses/`
- `GET /api/admin/responses/export.xlsx`
- `GET /api/admin/responses/export.pdf`
- `GET/POST /api/admin/users/`
- `GET/PATCH/DELETE /api/admin/users/{id}/`
- `POST /api/admin/users/{id}/reset-password/`
- `POST /api/admin/change-password/`

---

## Troubleshooting
- CORS in dev
  - `CORS_ALLOW_ALL_ORIGINS = True` in dev; restrict in prod
- Auth errors
  - Ensure Authorization header: `Bearer <access_token>`
  - Refresh via `/api/admin/token/refresh/`
- Database connection
  - Verify settings (NAME/USER/PASSWORD/HOST/PORT)
  - Apply migrations before starting
- Export issues
  - Large exports may take time; apply filters to scope data
- Dark mode visuals
  - Ensure Tailwind `dark:` classes applied consistently to buttons and controls

---

## Security & Production Notes
- Set `DEBUG = False` in production; configure `ALLOWED_HOSTS`
- Move secrets (DB password, SECRET_KEY, JWT settings) to environment variables
- Use HTTPS, secure cookies, and proper reverse proxy headers
- Backups: schedule DB dumps and media backups

---

## Appendix: Question Types
- rating: 1..5 scale, aggregated in analytics
- text / paragraph: free text
- regions: single-choice mapped to regional filter on dashboard
- dropdown / multiple_choice: single/multi select with options (one per line)
- linear_scale: numeric scale with optional per-point labels and min/max labels
