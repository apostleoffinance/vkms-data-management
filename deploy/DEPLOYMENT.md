# Production Deployment — Oracle Cloud Ubuntu VPS

This guide deploys VKMS on a single Ubuntu 22.04/24.04 VM (Oracle Cloud Free Tier or paid shape) with HTTPS, Nginx reverse proxy, and hardened defaults.

## Architecture

```
Internet
   │
   ▼
┌──────────────┐     ┌───────────┐     ┌───────────┐
│    Nginx     │────▶│  Frontend │     │ PostgreSQL│
│  :80 / :443  │     │   :3000   │     │   :5432   │
└──────┬───────┘     └───────────┘     └─────▲─────┘
       │                                      │
       └──────────────▶ Backend :8000 ──────────┘
              (Docker internal network only)
```

| Public URL | Service |
|------------|---------|
| `https://FRONTEND_DOMAIN` | Next.js app |
| `https://BACKEND_DOMAIN` | FastAPI API + `/health` |

**pgAdmin is not included in production.** Database admin is via `docker compose exec postgres psql` or scheduled backups.

---

## 1. Oracle Cloud VM setup

### Create the instance

1. Oracle Cloud Console → **Compute** → **Instances** → **Create instance**
2. **Image:** Ubuntu 22.04 or 24.04 (aarch64 Ampere or x86)
3. **Shape:** VM.Standard.E2.1.Micro (free tier) or larger for production load
4. **Networking:** assign a **public IPv4**
5. **SSH keys:** add your public key
6. Create the instance

### Open ports in Oracle Cloud Security List

In **VCN → Security Lists → Ingress Rules**, allow:

| Source | Protocol | Port | Description |
|--------|----------|------|-------------|
| `0.0.0.0/0` | TCP | 22 | SSH (restrict to your IP in production) |
| `0.0.0.0/0` | TCP | 80 | HTTP (ACME + redirect) |
| `0.0.0.0/0` | TCP | 443 | HTTPS |

Do **not** open 3000, 8000, 5432, or 5050.

### DNS

Create **A records** pointing to the VM public IP:

```
votagekids.example.com      → YOUR_VM_IP
api.votagekids.example.com  → YOUR_VM_IP
```

Wait for DNS propagation before requesting certificates.

---

## 2. Server bootstrap

SSH into the VM:

```bash
ssh ubuntu@YOUR_VM_IP
```

### Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git ufw fail2ban
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

**Recommendations:**

- Replace `OpenSSH` with `sudo ufw allow from YOUR_HOME_IP to any port 22` when you have a static IP
- Keep PostgreSQL, backend, and frontend off the public internet (handled by Docker — no host port bindings)
- Enable **fail2ban** for SSH: `sudo systemctl enable --now fail2ban`
- In Oracle Cloud, also restrict port 22 in the Security List to your IP when possible

---

## 3. Deploy the application

### Clone and configure

```bash
sudo mkdir -p /opt/vkms
sudo chown "$USER:$USER" /opt/vkms
git clone https://github.com/YOUR_ORG/children-church-database.git /opt/vkms
cd /opt/vkms

cp .env.production .env
nano .env   # set domains, secrets, admin password
```

Generate strong secrets:

```bash
openssl rand -hex 32      # JWT_SECRET_KEY
openssl rand -base64 24   # POSTGRES_PASSWORD
```

Required `.env` values:

| Variable | Example |
|----------|---------|
| `FRONTEND_DOMAIN` | `votagekids.example.com` |
| `BACKEND_DOMAIN` | `api.votagekids.example.com` |
| `LETSENCRYPT_EMAIL` | `admin@example.com` |
| `POSTGRES_PASSWORD` | strong random |
| `JWT_SECRET_KEY` | strong random |
| `DEFAULT_ADMIN_PASSWORD` | strong random |

Set `CERTBOT_STAGING=1` for a dry run first, then `0` for real certs.

### Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

On first boot, Nginx uses a temporary self-signed certificate until Let's Encrypt is configured.

### Obtain HTTPS certificates

```bash
chmod +x deploy/scripts/*.sh
./deploy/scripts/init-letsencrypt.sh
```

Verify:

```bash
curl -I "https://${FRONTEND_DOMAIN}"
curl "https://${BACKEND_DOMAIN}/health"
```

### Default admin login

Use the credentials from `.env` (`DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`). Change the password on first login.

---

## 4. Operations

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f nginx backend
```

### Update deployment

```bash
cd /opt/vkms
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

If `BACKEND_DOMAIN` or `NEXT_PUBLIC_API_URL` changes, rebuild the frontend:

```bash
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d
```

### Certificate renewal

Add a daily cron job on the host:

```bash
crontab -e
```

```
15 3 * * * /opt/vkms/deploy/scripts/renew-certs.sh >> /var/log/vkms-cert-renew.log 2>&1
```

### PostgreSQL backup strategy

**Automated daily backups** (recommended):

```bash
sudo mkdir -p /var/backups/vkms
sudo chown "$USER:$USER" /var/backups/vkms

crontab -e
```

```
30 2 * * * BACKUP_DIR=/var/backups/vkms RETENTION_DAYS=14 /opt/vkms/deploy/scripts/backup-postgres.sh >> /var/log/vkms-backup.log 2>&1
```

**Manual backup:**

```bash
./deploy/scripts/backup-postgres.sh
```

**Restore from backup:**

```bash
gunzip -c /var/backups/vkms/vkms_vkms_db_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vkms -d vkms_db
```

For a full restore to an empty database:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  dropdb -U vkms vkms_db --if-exists
docker compose -f docker-compose.prod.yml exec -T postgres \
  createdb -U vkms vkms_db
gunzip -c /var/backups/vkms/BACKUP_FILE.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vkms -d vkms_db
```

**Off-site copies:** sync `/var/backups/vkms` to Oracle Object Storage, S3, or another region:

```bash
# Example with rclone (install separately)
rclone sync /var/backups/vkms remote:vkms-backups
```

**Disaster recovery checklist:**

1. New VM with Docker + UFW
2. Restore `.env` from secure storage (never commit secrets)
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. Restore latest PostgreSQL dump
5. Run `./deploy/scripts/init-letsencrypt.sh` if certificates are not restored

---

## 5. Security summary

| Control | Implementation |
|---------|----------------|
| TLS | Let's Encrypt via Certbot |
| Public ports | 80, 443 only (nginx) |
| PostgreSQL | Internal Docker network, SCRAM-SHA-256 |
| pgAdmin | Removed from production stack |
| Cookies | `COOKIE_SECURE=true` |
| CORS | Locked to `https://FRONTEND_DOMAIN` |
| Restart policy | `unless-stopped` on all services |
| Health checks | postgres, backend, frontend, nginx |
| Non-root backend | Runs as UID 1000 |
| Resource limits | Memory caps per service |

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Nginx restart loop | Check `docker compose logs nginx`; ensure domains in `.env` match DNS |
| Certbot fails | Confirm DNS A records, port 80 reachable, try `CERTBOT_STAGING=1` |
| Frontend can't reach API | Rebuild frontend after changing `BACKEND_DOMAIN` |
| 502 Bad Gateway | Wait for backend health check: `docker compose ps` |
| CORS errors | `CORS_ORIGINS` must exactly match `https://FRONTEND_DOMAIN` |

---

## 7. Quick reference

```bash
# Start
docker compose -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.prod.yml down

# Stop and wipe data (destructive)
docker compose -f docker-compose.prod.yml down -v
```
