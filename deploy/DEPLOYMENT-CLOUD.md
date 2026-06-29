# Cloud Deployment — Neon + Render + Vercel ($0 tier)

Deploy VKMS with:

- **Frontend** → Vercel (Next.js)
- **Backend** → Render (FastAPI, free tier)
- **Database** → Neon (PostgreSQL, free tier)

```
GitHub
   │
   ├────────────► Vercel ──► Next.js (https://your-app.vercel.app)
   │                              │
   │                    HTTPS + cookies
   │                              ▼
   └────────────► Render ──► FastAPI (https://your-api.onrender.com)
                                  │
                                  ▼
                            Neon PostgreSQL
```

Local development still uses `docker compose up -d --build`.

---

## Prerequisites

- GitHub repo pushed with **full `frontend/` source** (not a submodule)
- Accounts: [Neon](https://neon.tech), [Render](https://render.com), [Vercel](https://vercel.com)
- Optional: [UptimeRobot](https://uptimerobot.com) free monitor (reduces Render cold starts)

---

## YOUR PART — Step by step

### Step 1 — Push latest code to GitHub

On your Mac:

```bash
cd /Users/olaoluwatunmise/children-church-database
git status
git add .
git commit -m "Add cloud deployment config for Render, Vercel, Neon"
git push origin main
```

Verify on GitHub: `frontend/package.json` and `backend/start.sh` are visible.

---

### Step 2 — Create Neon database

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Name: `vkms-prod`
3. Copy the **connection string** (Direct connection is fine to start)
4. Ensure it ends with `?sslmode=require`
5. Save it — you will paste it into Render in Step 3

Example shape:

```
postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

---

### Step 3 — Deploy backend on Render

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect GitHub repo: `vkms-data-management`
3. Configure:

| Field | Value |
|-------|--------|
| **Name** | `vkms-api` (or any name) |
| **Region** | Closest to you (e.g. Frankfurt) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `bash start.sh` |
| **Instance Type** | **Free** |

4. **Environment Variables** → Add:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | *(paste Neon connection string)* |
| `JWT_SECRET_KEY` | Run `openssl rand -hex 32` on your Mac |
| `CORS_ORIGINS` | `http://localhost:3000,https://YOUR-APP.vercel.app` *(use placeholder Vercel URL for now)* |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `DEBUG` | `false` |
| `DEFAULT_ADMIN_EMAIL` | `admin@votagekids.org` |
| `DEFAULT_ADMIN_PASSWORD` | *strong password you choose* |

5. **Advanced** → Health Check Path: `/health`
6. Click **Create Web Service** → wait for deploy (~5–10 min first time)

7. **Test** (replace with your Render URL):

```
https://vkms-api.onrender.com/health
https://vkms-api.onrender.com/api/docs
```

Expected: `/health` returns `{"status":"healthy",...}` and Swagger loads.

**Stop here if backend fails** — fix Render logs before continuing.

---

### Step 4 — Keep Render warm (recommended for Sunday use)

Render free tier sleeps after ~15 minutes idle.

1. [uptimerobot.com](https://uptimerobot.com) → free account
2. **Add Monitor** → HTTP(s)
3. URL: `https://YOUR-SERVICE.onrender.com/health`
4. Interval: **5 minutes** (or every 10–14 min)

This reduces cold-start delays on check-in day.

---

### Step 5 — Deploy frontend on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import GitHub repo
2. Configure:

| Field | Value |
|-------|--------|
| **Root Directory** | `frontend` |
| **Framework** | Next.js (auto) |

3. **Environment Variables**:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-SERVICE.onrender.com` *(no trailing slash)* |

4. Click **Deploy** → note your URL, e.g. `https://vkms-data-management.vercel.app`

---

### Step 6 — Update Render CORS with real Vercel URL

1. Render dashboard → your web service → **Environment**
2. Update `CORS_ORIGINS`:

```
http://localhost:3000,https://vkms-data-management.vercel.app
```

Use your **exact** Vercel URL (no trailing slash).

3. **Save** → Render will redeploy automatically

---

### Step 7 — End-to-end test

Open your **Vercel URL** in the browser:

| Test | Expected |
|------|----------|
| Login page loads | Yes |
| Login with admin | `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` from Render |
| Change password prompt | First login may require password change |
| Dashboard | Stats load |
| Register child | Saves |
| Check in | Tag assigned |
| Check out | Works |

**If login fails** but `/api/docs` works on Render:

- Confirm `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` on Render
- Confirm `CORS_ORIGINS` matches Vercel URL exactly
- Hard refresh browser (or incognito)

**If first load is slow (~30–60s):** Render cold start — wait, or use UptimeRobot.

---

## Optional — Deploy Render from blueprint

Instead of manual setup, Render can read `render.yaml` at repo root:

1. Render → **New +** → **Blueprint**
2. Connect repo → review services → set `DATABASE_URL` and `DEFAULT_ADMIN_PASSWORD` when prompted

You still need Neon and Vercel steps separately.

---

## Environment reference

See `.env.cloud.example` for all variables.

| Platform | Variables |
|----------|-----------|
| **Neon** | Connection string only (used as `DATABASE_URL` on Render) |
| **Render** | `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `COOKIE_*`, `DEFAULT_ADMIN_*` |
| **Vercel** | `NEXT_PUBLIC_API_URL` |

---

## Data maintenance

### Duplicate children (after bulk import)

If the same child appears twice under one parent, run the dedupe script against your Neon database:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."   # Neon connection string
python scripts/dedupe_children.py --dry-run
python scripts/dedupe_children.py
```

See [README — Duplicate children cleanup](../README.md#duplicate-children-cleanup) for matching rules and keeper logic.

---

## Updates after code changes

```bash
git push origin main
```

- Render redeploys backend automatically
- Vercel redeploys frontend automatically

If you change `BACKEND_DOMAIN` or API URL, update `NEXT_PUBLIC_API_URL` on Vercel and redeploy.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Render build fails | Check **Logs** tab; confirm Root Directory is `backend` |
| `relation does not exist` | Migrations failed — check `alembic upgrade head` in Render logs |
| Login works locally, not on Vercel | `CORS_ORIGINS` + `COOKIE_SAMESITE=none` |
| CORS error in browser | Vercel URL must be in `CORS_ORIGINS` exactly |
| Neon connection error | Add `?sslmode=require`; use Direct connection string |
| Vercel build fails | Confirm `frontend/` is in repo (not submodule) |
| Slow Sunday morning | UptimeRobot ping on `/health` |

---

## Data safety

- Data lives in **Neon**, not in Render containers
- Redeploying Render does **not** wipe your database
- Neon free tier includes backup/history — check Neon console for retention

---

## Local dev (unchanged)

```bash
docker compose up -d --build
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000
