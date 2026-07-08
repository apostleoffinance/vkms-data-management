# Votage Kids Management System (VKMS)

A children church attendance and check-in/check-out management system for Votage Kids Church.

**Repository:** [github.com/apostleoffinance/vkms-data-management](https://github.com/apostleoffinance/vkms-data-management)

---

## What this app does

- Register children and link them to parents/guardians
- Check children in and out per church service
- Assign **service tags** at check-in (sequential per service, e.g. 001, 002 — unique per service, not permanent child IDs)
- **Authorized pickup contacts** with photos — select who dropped off / picked up at check-in and check-out
- **One attendance row per child per service date** — prevents duplicate check-in/check-out
- **One active child per first name per parent** — siblings allowed; duplicate names under the same parent are blocked (registration, bulk import, and DB)
- Admin dashboard with charts, reports, and bulk Excel import
- **Children search** — browse and filter (e.g. missing pickup photos)
- **Service management** — create, rename, and delete services (one service per calendar date)
- **Executive ministry reports** — AI-powered KPIs, retention, charts, follow-up list (admin)
- **Worker roster** attendance (admin kiosk — workers tap their name, no login required)
- **Parent check-in kiosk** — public `/kiosk` page: parents look up by phone, scan child QR, or register a new child; receive a service tag on their phone. Check-out remains staff-only at the front desk.
- Audit logging and role-based access control

---

## Architecture

### Local development (Docker)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Next.js 15 │────▶│   FastAPI   │────▶│  PostgreSQL  │
│  :3000      │     │   :8000     │     │  (internal)  │
└─────────────┘     └─────────────┘     └──────────────┘
```

### Production (cloud — current)

```
GitHub
   │
   ├────────────► Vercel ──────► Next.js frontend
   │                                  │
   │                         HTTPS + cookies
   │                                  ▼
   └────────────► Render ──────► FastAPI backend
                                      │
                                      ▼
                               Neon PostgreSQL
```

Optional: [UptimeRobot](https://uptimerobot.com) pings Render `/health` to reduce free-tier cold starts.

### Production (alternative — VPS)

All services on one Ubuntu VM behind Nginx with Let's Encrypt. See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, React Query |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.0, Pydantic, Alembic |
| Database | PostgreSQL 16 (Docker locally; Neon in cloud) |
| Auth | JWT in httpOnly cookies, bcrypt |
| Local ops | Docker Compose |
| Cloud | Vercel + Render + Neon |

---

## User roles

| Role | Access |
|------|--------|
| **Admin** | Full access — users, services, children, reports, executive reports, worker roster, worker attendance kiosk |
| **Worker** (login account) | Child check-in/out, search children |

**Worker roster** (separate from login accounts): names used on the shared **Worker Attendance** screen. Managed under **Manage Workers**; no user account required.

---

## Prerequisites

**Docker (recommended for local dev):**

- Docker Desktop (or Docker Engine + Compose v2)
- Git

**Manual local setup (optional):**

- Node.js 20+
- Python 3.12+
- PostgreSQL 16+

---

## Quick start — local (Docker)

```bash
git clone https://github.com/apostleoffinance/vkms-data-management.git
cd vkms-data-management

# Optional: copy and edit local env (defaults work for Docker)
cp .env.example .env

# Start in background (recommended)
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/api/docs |
| Health check | http://localhost:8000/health |
| pgAdmin (dev only) | http://localhost:5050 |

### Stop / reset

```bash
# Stop containers
docker compose down

# Stop and delete database volume (wipes all data)
docker compose down -v
```

> **Note:** PostgreSQL is not exposed on host port `5432` in Docker Compose (avoids conflict with a local Postgres install). Access the DB via `docker compose exec postgres psql -U vkms -d vkms_db` or pgAdmin.

### Local admin login

On first run, the seed script creates an admin user from `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` in your environment (see `.env.example`). Docker Compose defaults are documented there — **change them for any shared or production environment.**

Admin is prompted to change password on first login.

---

## Local development (without full Docker stack)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # edit DATABASE_URL if needed
# Or set DATABASE_URL in the repo root .env — config loads ../.env automatically

# Postgres only via Docker
docker compose up postgres -d

alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

---

## Environment variables

Never commit real secrets. Use platform dashboards or local `.env` files (gitignored).

| File | Purpose |
|------|---------|
| [.env.example](.env.example) | Local Docker / shared reference |
| [backend/.env.example](backend/.env.example) | Backend-only local dev |
| Repo root `.env` | Also loaded by backend when running from `backend/` (e.g. Neon `DATABASE_URL` for local Alembic) |
| [frontend/.env.example](frontend/.env.example) | Frontend local dev |
| [.env.cloud.example](.env.cloud.example) | Cloud deployment reference (no real values) |
| [.env.production](.env.production) | VPS Docker production template |

### Backend (key variables)

| Variable | Local (Docker) | Cloud (Render) |
|----------|----------------|----------------|
| `DATABASE_URL` | `postgresql://…@postgres:5432/vkms_db` | Neon connection string with `?sslmode=require` |
| `JWT_SECRET_KEY` | Long random string | Long random string (e.g. `openssl rand -hex 32`) |
| `CORS_ORIGINS` | `http://localhost:3000` | `http://localhost:3000,https://your-app.vercel.app` |
| `COOKIE_SECURE` | `false` | `true` |
| `COOKIE_SAMESITE` | `lax` | `none` (required for Vercel ↔ Render cross-origin) |
| `DEFAULT_ADMIN_EMAIL` | See `.env.example` | Your admin email |
| `DEFAULT_ADMIN_PASSWORD` | See `.env.example` | Strong password (set only in Render env) |
| `GEMINI_API_KEY` | Optional | Optional — AI executive report summaries ([Google AI Studio](https://aistudio.google.com)) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `KIOSK_ENABLED` | `true` | Set `false` to disable parent kiosk API |
| `KIOSK_TOKEN` | Empty (open) | Optional shared secret — require `X-Kiosk-Token` header or `?token=` query |

### Frontend

| Variable | Local | Cloud (Vercel) |
|----------|-------|----------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | `https://your-api.onrender.com` |
| `NEXT_PUBLIC_KIOSK_TOKEN` | Empty | Must match Render `KIOSK_TOKEN` when set |

> `NEXT_PUBLIC_API_URL` is embedded at **build time** on Vercel. After changing it, **redeploy** the frontend.

See [.env.cloud.example](.env.cloud.example) for a full cloud env checklist.

### Render-specific

| Variable | Value |
|----------|--------|
| `PYTHON_VERSION` | `3.12.8` (avoids Python 3.14 build failures) |

---

## Production deployment

### Cloud — Neon + Render + Vercel (recommended)

Deploy in this order:

1. **Neon** — create PostgreSQL project → copy `DATABASE_URL`
2. **Render** — deploy `backend/` → test `/health` and `/api/docs`
3. **UptimeRobot** (optional) — monitor `https://your-api.onrender.com/health`
4. **Vercel** — deploy `frontend/` with `NEXT_PUBLIC_API_URL`
5. **Render** — update `CORS_ORIGINS` with exact Vercel URL → redeploy

**Full guide:** [deploy/DEPLOYMENT-CLOUD.md](deploy/DEPLOYMENT-CLOUD.md)

#### Render web service settings

| Setting | Value |
|---------|--------|
| Root Directory | `backend` |
| Language | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `bash start.sh` |
| Health Check Path | `/health` |
| `PYTHON_VERSION` | `3.12.8` |

`backend/start.sh` runs migrations, idempotent seed, then Uvicorn on `$PORT`.

#### Live URLs (replace with your own)

| Service | Example pattern |
|---------|-----------------|
| Frontend | `https://<project>.vercel.app` |
| Backend | `https://<service>.onrender.com` |
| API docs | `https://<service>.onrender.com/api/docs` |

### VPS — Docker + Nginx + Let's Encrypt

```bash
cp .env.production .env   # edit domains and secrets
docker compose -f docker-compose.prod.yml up -d --build
./deploy/scripts/init-letsencrypt.sh
```

**Full guide:** [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)

### Deployment comparison

| | Cloud (Render/Vercel/Neon) | VPS (Docker prod) |
|--|---------------------------|-------------------|
| Cost | Free tiers available | VM cost (Oracle free tier possible) |
| Ops | Low | You manage SSL, firewall, backups |
| Cold starts | Render free tier sleeps | Always on if VM stays up |
| Best for | Fast deploy, small team | Full control, Sunday reliability at $0 |

---

## Database

- **Version:** PostgreSQL 16 (Docker image `postgres:16-alpine`)
- **Migrations:** Alembic — `backend/alembic/versions/` (001–008)
- **Seed:** `backend/scripts/seed.py` (idempotent — safe on every deploy; creates admin only if missing)
- **Dedupe:** `backend/scripts/dedupe_children.py` — merge duplicate children under the same parent (see below)

> **Alembic note:** Revision IDs must be **≤ 32 characters** (`alembic_version.version_num` is `VARCHAR(32)`).

```bash
# Run migrations manually (local — use project venv, not system conda alembic)
cd backend
source .venv/bin/activate   # or: python -m venv .venv && pip install -r requirements.txt
alembic upgrade head       # reads DATABASE_URL from ../.env or backend/.env

# Create new migration after model changes
alembic revision --autogenerate -m "describe change"
```

> **Important:** Always **push migration files to GitHub before** running `alembic upgrade head` against Neon locally. If the database revision is ahead of deployed code, Render will fail with `Can't locate revision identified by '…'`.

### Data integrity rules

| Rule | Enforced by |
|------|-------------|
| One service per calendar date | API + DB unique on `service_date` |
| One check-in per child per service date | API + DB unique on `child_id` + `service_date` |
| Unique tag per service (001, 002, …) | `MAX(tag)+1` assignment, row lock at check-in, DB unique on `service_id` + `tag_number` |
| One active child per first name per parent | API (fuzzy match) + DB unique index on normalized first name |
| Parent reuse by phone at registration | `get_or_create_parent()` |

### Duplicate children cleanup

Each parent may have multiple children, but **no two active children under the same parent may share the same first name** (including variants like `Triumph` and `Triumph Oghenemairo`). Registration, bulk import, and updates enforce this in the API; migration `007` adds a database unique index on exact normalized first names per parent.

After a bulk import, use `dedupe_children.py` to merge any duplicates that slipped in earlier:

```bash
cd backend
source venv/bin/activate   # or: .venv/bin/activate

# Uses DATABASE_URL from repo root .env or backend/.env
python scripts/dedupe_children.py --dry-run   # preview only
python scripts/dedupe_children.py             # apply changes
```

Safe to re-run — reports `No duplicate children found.` when the database is clean.

Current migration chain:

| Revision | Purpose |
|----------|---------|
| 001 | Initial schema |
| 002 | Workers roster |
| 003 | Unique service name + date |
| 004 | One service per calendar date |
| 005 | Authorized pickup contacts + attendance FKs |
| 006 | `service_date` on attendance + unique constraint per child/date |
| 007 | Unique active first name per parent (exact match at DB level) |
| 008 | Unique tag number per service |

### Main tables

| Table | Purpose |
|-------|---------|
| `users` | Admin and worker login accounts |
| `workers` | Worker roster (no login — kiosk attendance) |
| `parents` | Parent/guardian records |
| `children` | Registered children (`VK-#####` codes) |
| `classes` | Age-based class groups |
| `services` | Church service sessions (one per date) |
| `attendance` | Child check-in/out per service (tag, `service_date`, pickup contacts) |
| `authorized_pickup_contacts` | Approved pickup people + photos per child |
| `worker_attendance` | Worker presence per service |
| `audit_logs` | Security audit trail |

---

## Domain concepts

### Child code vs service tag

- **Child code** (`VK-#####`): permanent ID assigned at registration
- **Service tag** (`001`, `002`, …): assigned **only at check-in**, per service, in check-in order; **unique within that service**; resets each new service day

### Parent lookup

Registration and bulk import match an existing parent by phone number to attach siblings without duplicating parent rows. A parent may have many children, but **not two active children with the same first name** (e.g. `Triumph` and `Triumph Oghenemairo` are treated as duplicates).

### Worker attendance

Admin opens **Worker Attendance** on a shared device. Workers search their name in a dropdown and mark present — no individual login.

### Parent check-in kiosk

Print **one permanent facility QR** from **Services** and mount it at the entrance. Parents scan it with their phone each Sunday — no per-child QR needed at the stand.

1. Ensure **today's service** exists (Services → Add Service).
2. Parent scans the facility QR (opens `/kiosk`).
3. **Returning families:** enter phone number → select child → receive tag on screen.
4. **New families:** register child + parent details → auto check-in with tag.
5. Parent shows the **tag number** at the front desk when dropping off; staff use the tag at pickup.

**Front desk fallback:** staff use **Check In** for parents without a phone or internet — same tags, same attendance records.

Check-out is **not** on the kiosk — staff verify pickup at the front desk as before.

Optional: set `KIOSK_TOKEN` on Render and `NEXT_PUBLIC_KIOSK_TOKEN` on Vercel (same value) to restrict kiosk API access.

### Authorized pickup

Each child can have multiple **authorized pickup contacts** (primary parent/guardian plus others). Photos are stored in the database. At check-in, staff select who dropped the child off; at check-out, they verify who is picking up.

### Executive reports (admin)

On **Reports**, admins can generate an **Executive Report** with:

- KPIs (attendance, check-in rate, workers, growth)
- Retention analysis and class breakdown charts
- Follow-up list for children absent 2+ consecutive services
- AI-written summary, insights, and recommendations (Gemini — optional; template fallback if no API key)

Export options:

- **Print / Save PDF** — colorful HTML report from the browser (recommended)
- **Basic PDF** — server-generated PDF via ReportLab

Set `GEMINI_API_KEY` on the backend for AI summaries. See [backend/.env.example](backend/.env.example).

---

## API overview

Interactive docs: `/api/docs` (Swagger) when the backend is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Current user |
| GET | `/api/v1/children/search?q=` | Search children |
| POST | `/api/v1/children` | Register child |
| POST | `/api/v1/attendance/check-in` | Check in child (assigns tag, records drop-off contact) |
| POST | `/api/v1/attendance/check-out` | Check out child (records pickup contact) |
| GET | `/api/v1/dashboard/stats` | Dashboard stats |
| GET | `/api/v1/dashboard/charts` | Dashboard chart data |
| GET | `/api/v1/reports/executive` | Executive report preview (admin) |
| GET | `/api/v1/reports/executive/export` | Executive report PDF (admin) |
| GET | `/api/v1/reports/export` | Export attendance/worker reports (CSV/Excel/PDF) |
| GET | `/api/v1/authorized-pickups/children/{id}` | List pickup contacts for a child |
| POST | `/api/v1/authorized-pickups/children/{id}` | Add pickup contact |
| GET | `/api/v1/workers` | Worker roster |
| POST | `/api/v1/worker-attendance` | Mark worker present |
| GET | `/api/v1/kiosk/service/today` | Today's service (public kiosk) |
| POST | `/api/v1/kiosk/lookup` | Parent phone lookup (public kiosk) |
| POST | `/api/v1/kiosk/check-in` | Parent self check-in (public kiosk) |
| POST | `/api/v1/kiosk/register` | Register child + check-in (public kiosk) |
| GET | `/api/v1/kiosk/qr?data=` | Parse child QR payload (public kiosk) |

---

## Bulk import

Upload `.xlsx` (admin only) via UI or `POST /api/v1/children/bulk-import`.

Rows are skipped when the parent already has an active child with a conflicting first name (same rule as single registration). Parents are matched or created by phone.

| Column | Field |
|--------|-------|
| A | First Name |
| B | Last Name |
| C | Gender |
| D | Date of Birth |
| E | Class Name |
| F | Parent First Name |
| G | Parent Last Name |
| H | Phone |
| I | Alternative Phone |
| J | Email |
| K | Address |
| L | Medical Notes |

---

## Security

- JWT in httpOnly cookies (`credentials: "include"` from frontend)
- bcrypt password hashing
- Role-based access control
- Rate limiting (default `100/minute`)
- Pydantic + Zod validation
- SQLAlchemy ORM (parameterized queries)
- Audit logging on sensitive actions
- Security headers middleware

**Cross-origin (Vercel + Render):** set `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and include the exact Vercel origin in `CORS_ORIGINS`. The frontend also stores the JWT in `sessionStorage` and sends `Authorization: Bearer` headers so login works on mobile browsers (iOS/iPad) where cross-site cookies are blocked.

---

## Troubleshooting

### Local Docker

| Issue | Fix |
|-------|-----|
| Port 5432 in use | Postgres is internal-only in Compose; use `docker compose exec postgres psql …` |
| Terminal hangs on `docker compose up` | Use `docker compose up -d --build` |
| Frontend can't reach API | Check `NEXT_PUBLIC_API_URL` and that backend is healthy |

### Cloud

| Issue | Fix |
|-------|-----|
| Login shows "Failed to fetch" | Set `NEXT_PUBLIC_API_URL` on Vercel and **redeploy**; set `CORS_ORIGINS` + `COOKIE_SAMESITE=none` on Render |
| Login loops on phone/iPad | Deploy latest code (Bearer token auth); clear site data and retry |
| Render build fails on `pydantic-core` | Set `PYTHON_VERSION=3.12.8` on Render |
| Alembic migration fails on deploy | Check Render logs; revision IDs must be ≤ 32 chars; ensure migration file is **pushed to GitHub** before DB is upgraded locally |
| `Can't locate revision identified by '00…'` | Database revision ahead of deployed code — push latest `main` and redeploy Render |
| Local `alembic` connects to localhost | Set `DATABASE_URL` in repo root `.env`; use `backend/.venv/bin/alembic`, not conda global alembic |
| Duplicate child under same parent | Run `scripts/dedupe_children.py` against Neon; new registrations are blocked by API |
| Two children same tag number | Prevented by migration 008 — unique tag per service |
| Seed fails after deploy | Ensure all models are imported in `backend/app/models/__init__.py` |
| Slow first request | Render free cold start — use UptimeRobot or upgrade plan |
| CORS errors | Vercel URL in `CORS_ORIGINS` must match exactly (no trailing slash) |
| Executive report has no AI text | Set `GEMINI_API_KEY` on Render; template summary used if unset |
| PDF report text hard to read | Use **Print / Save PDF** (browser); enable “Background graphics” in print dialog |

---

## Project structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/       # REST endpoints
│   │   ├── core/             # Auth, dependencies
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic (analytics, AI, pickup, reports)
│   ├── alembic/              # Migrations (001–008)
│   ├── scripts/
│   │   ├── seed.py           # Idempotent seed
│   │   └── dedupe_children.py  # Merge duplicate children (post-import)
│   ├── start.sh              # Cloud startup (migrate + seed + uvicorn)
│   └── Dockerfile
├── frontend/
│   ├── src/app/              # Next.js App Router pages
│   ├── src/components/       # UI components (dashboard, pickup, reports)
│   ├── src/lib/api.ts        # API client
│   └── vercel.json
├── deploy/
│   ├── DEPLOYMENT-CLOUD.md   # Vercel + Render + Neon guide
│   ├── DEPLOYMENT.md         # VPS / Oracle guide
│   ├── nginx/                # Production reverse proxy
│   └── scripts/              # SSL init, backups, cert renewal
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # VPS production
├── render.yaml               # Optional Render blueprint
└── .env.cloud.example        # Cloud env reference
```

---

## Contributing / onboarding checklist

1. Clone repo and run `docker compose up -d --build`
2. Open http://localhost:3000 and log in with local admin credentials from `.env.example`
3. Read `/api/docs` for API shape
4. Run migrations after pulling: `docker compose up -d --build` (backend runs `alembic upgrade head` on start)
5. Do not commit `.env`, production passwords, or Neon connection strings

---

## License

Proprietary — Votage Kids Church
