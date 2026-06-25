# Votage Kids Management System (VKMS)

A children church attendance and check-in/check-out management system for Votage Kids Church.

**Repository:** [github.com/apostleoffinance/vkms-data-management](https://github.com/apostleoffinance/vkms-data-management)

---

## What this app does

- Register children and link them to parents/guardians
- Check children in and out per church service
- Assign **service tags** at check-in (sequential per service, e.g. 001, 002 — not permanent child IDs)
- Admin dashboard, reports, and bulk Excel import
- **Worker roster** attendance (admin kiosk — workers tap their name, no login required)
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
| **Admin** | Full access — users, services, children, reports, worker roster, worker attendance kiosk |
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

### Frontend

| Variable | Local | Cloud (Vercel) |
|----------|-------|----------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | `https://your-api.onrender.com` |

> `NEXT_PUBLIC_API_URL` is embedded at **build time** on Vercel. After changing it, **redeploy** the frontend.

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
- **Migrations:** Alembic — `backend/alembic/versions/`
- **Seed:** `backend/scripts/seed.py` (idempotent — safe on every deploy; creates admin only if missing)

```bash
# Run migrations manually (local)
cd backend && alembic upgrade head

# Create new migration after model changes
alembic revision --autogenerate -m "describe change"
```

### Main tables

| Table | Purpose |
|-------|---------|
| `users` | Admin and worker login accounts |
| `workers` | Worker roster (no login — kiosk attendance) |
| `parents` | Parent/guardian records |
| `children` | Registered children (`VK-#####` codes) |
| `classes` | Age-based class groups |
| `services` | Church service sessions |
| `attendance` | Child check-in/out per service (includes service tag) |
| `worker_attendance` | Worker presence per service |
| `audit_logs` | Security audit trail |

---

## Domain concepts

### Child code vs service tag

- **Child code** (`VK-#####`): permanent ID assigned at registration
- **Service tag** (`001`, `002`, …): assigned **only at check-in**, per service, in check-in order; resets each service day

### Parent lookup

Registration can match an existing parent by phone number to attach siblings without duplicating parent rows.

### Worker attendance

Admin opens **Worker Attendance** on a shared device. Workers search their name in a dropdown and mark present — no individual login.

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
| POST | `/api/v1/attendance/check-in` | Check in child (assigns tag) |
| POST | `/api/v1/attendance/check-out` | Check out child |
| GET | `/api/v1/dashboard/stats` | Dashboard stats |
| GET | `/api/v1/reports/export` | Export reports |
| GET | `/api/v1/workers` | Worker roster |
| POST | `/api/v1/worker-attendance` | Mark worker present |

---

## Bulk import

Upload `.xlsx` (admin only) via UI or `POST /api/v1/children/bulk-import`.

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
| Slow first request | Render free cold start — use UptimeRobot or upgrade plan |
| CORS errors | Vercel URL in `CORS_ORIGINS` must match exactly (no trailing slash) |

---

## Project structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/       # REST endpoints
│   │   ├── core/             # Auth, dependencies
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic
│   ├── alembic/              # Migrations
│   ├── scripts/seed.py       # Idempotent seed
│   ├── start.sh              # Cloud startup (migrate + seed + uvicorn)
│   └── Dockerfile
├── frontend/
│   ├── src/app/              # Next.js App Router pages
│   ├── src/components/       # UI components
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
