# Votage Kids Management System (VKMS)

A production-ready children church attendance and check-in/check-out management system.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Next.js 15 │────▶│   FastAPI   │────▶│  PostgreSQL  │
│  Frontend   │     │   Backend   │     │   Database   │
└─────────────┘     └─────────────┘     └──────────────┘
     :3000               :8000          (postgres internal)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI, React Query |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL 16 |
| Auth | JWT (httpOnly cookies), bcrypt |
| Migrations | Alembic |
| Deployment | Docker, Docker Compose |

### User Roles

- **Admin**: Full access — users, classes, children, reports, dashboards
- **Worker**: Check-in/out, search children, worker attendance

## Quick Start (Docker)

```bash
# Clone and start all services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/api/docs |
| pgAdmin | http://localhost:5050 |

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@votagekids.org | Admin123! |
| Worker | sarah.johnson@votagekids.org | Worker123! |

> Admin is prompted to change password on first login.

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Start PostgreSQL (or use Docker for postgres only)
docker compose up postgres -d

alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Current user |
| GET | `/api/v1/children/search?q=` | Search children |
| POST | `/api/v1/children` | Register child |
| POST | `/api/v1/attendance/check-in` | Check in child |
| POST | `/api/v1/attendance/check-out` | Check out child |
| GET | `/api/v1/dashboard/stats` | Dashboard stats |
| GET | `/api/v1/reports/export` | Export reports |

Full API documentation at `/api/docs` when backend is running.

## Database Schema

- `users` — Admin and worker accounts
- `parents` — Parent/guardian information
- `classes` — Age-based class groups
- `children` — Registered children with VK-##### codes
- `services` — Church service sessions
- `attendance` — Child check-in/out per service
- `worker_attendance` — Worker presence tracking
- `audit_logs` — Security audit trail

## Security Features

- JWT authentication with httpOnly secure cookies
- bcrypt password hashing
- Role-based access control (RBAC)
- Rate limiting (100 req/min)
- Input validation (Pydantic + Zod)
- SQL injection protection (SQLAlchemy ORM)
- Audit logging
- Security headers middleware
- CSRF protection via SameSite cookies

## Bulk Import

Upload an Excel file (`.xlsx`) with columns:

| Column | Field |
|--------|-------|
| A | First Name |
| B | Last Name |
| C | Gender (male/female/other) |
| D | Date of Birth |
| E | Class Name |
| F | Parent First Name |
| G | Parent Last Name |
| H | Phone |
| I | Alternative Phone |
| J | Email |
| K | Address |
| L | Medical Notes |

Use `POST /api/v1/children/bulk-import` (admin only).

## Production Deployment

### Cloud ($0) — Neon + Render + Vercel (recommended if Oracle signup fails)

```bash
# Push code, then follow the dashboard steps in:
```

**[deploy/DEPLOYMENT-CLOUD.md](deploy/DEPLOYMENT-CLOUD.md)** — step-by-step for Neon database, Render API, Vercel frontend.

| Service | Platform |
|---------|----------|
| Frontend | Vercel |
| Backend | Render |
| Database | Neon PostgreSQL |

### VPS — Oracle Cloud / Ubuntu (always-on, no cold starts)

```bash
cp .env.production .env
docker compose -f docker-compose.prod.yml up -d --build
./deploy/scripts/init-letsencrypt.sh
```

**[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)** — Oracle Cloud VM, Nginx, SSL, backups.

| Environment | Compose file | Public ports |
|-------------|--------------|--------------|
| Local dev | `docker-compose.yml` | 3000, 8000, 5050 |
| VPS production | `docker-compose.prod.yml` | 80, 443 (nginx only) |
| Cloud production | Render + Vercel + Neon | HTTPS on each platform |

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:
- `JWT_SECRET_KEY` — Change in production
- `DATABASE_URL` — PostgreSQL connection string
- `NEXT_PUBLIC_API_URL` — Backend URL for frontend

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/routes/     # API endpoints
│   │   ├── core/           # Security, dependencies
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   ├── alembic/            # Database migrations
│   └── scripts/seed.py     # Sample data seeder
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages
│       ├── components/     # UI components
│       └── lib/            # API client, utilities
└── docker-compose.yml
```

## License

Proprietary — Votage Kids Church
