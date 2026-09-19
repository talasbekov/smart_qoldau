# VPS and Plane ngrok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the SmartQoldau production Compose stack on the supplied VPS and expose local Plane on port 8090 using an automatic ngrok HTTPS hostname.

**Architecture:** SmartQoldau is copied to `/opt/smart-qoldau` and run with the existing production Compose definition. Stateful services retain named Docker volumes and are unreachable from the public network. ngrok remains a separate local user service that forwards only to loopback Plane.

**Tech Stack:** Ubuntu/Debian host administration, Docker Engine and Compose v2, NestJS/Next.js containers, PostgreSQL 16, Redis 7, MinIO, ngrok, systemd user services.

**Spec:** `docs/superpowers/specs/2026-09-18-vps-and-plane-ngrok-design.md`

## Global Constraints

- Never print or commit the supplied SSH password, ngrok token, or generated application secrets.
- Copy neither `.env` files nor `.git` metadata to the server.
- Deploy at `/opt/smart-qoldau`; never delete Docker volumes during deploy or rollback.
- Do not make PostgreSQL, Redis, MinIO, or Plane port 8090 directly public.
- Do not enable Caddy automatic TLS until real DNS records exist for all three hostnames.

---

### Task 1: Validate VPS access and host prerequisites

**Files:**
- Create: `/opt/smart-qoldau` on the VPS after preflight passes
- Inspect: `infra/docker-compose.prod.yml`

**Interfaces:**
- Consumes: the supplied VPS IP and root credential
- Produces: SSH access, OS/package-manager identification, Docker availability, disk and firewall inventory

- [ ] **Step 1: Verify non-interactive SSH authentication without echoing the password**

Run locally with the password supplied through a protected `SSHPASS` environment variable, never as a command argument:

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 root@84.247.162.192 'id -un'
```

Expected: output is exactly `root` and exit code is 0.

- [ ] **Step 2: Inspect host OS, capacity, Docker, and inbound firewall state**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'set -eu; . /etc/os-release; printf "OS=%s\\n" "$ID"; df -h /; docker --version || true; docker compose version || true; (ufw status || true); ss -ltn'
```

Expected: a Debian/Ubuntu-compatible host, at least 12 GB free on `/`, and no existing listener that conflicts with the selected published application port.

- [ ] **Step 3: Install Docker Engine and Compose only when absent**

For an Ubuntu/Debian host where `docker --version` failed, run:

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'set -eu; apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 rsync openssl; systemctl enable --now docker; docker --version; docker compose version'
```

Expected: both Docker commands return version information and the Docker daemon is enabled.

- [ ] **Step 4: Create the deployment directory with safe permissions**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'install -d -m 0750 /opt/smart-qoldau'
```

Expected: `/opt/smart-qoldau` exists and is accessible only to root and its group.

### Task 2: Transfer source and establish server-only production configuration

**Files:**
- Create: `/opt/smart-qoldau/` (VPS source tree)
- Create: `/opt/smart-qoldau/infra/.env` (VPS only, mode 0600)
- Read: `infra/.env.prod.example`, `backend/.env.example`, `infra/docker-compose.prod.yml`

**Interfaces:**
- Consumes: validated SSH access and current repository source
- Produces: an immutable source copy and an `.env` file accepted by Compose

- [ ] **Step 1: Extract only required environment variable names**

```bash
awk -F= '/^[A-Z][A-Z0-9_]*=/{print $1}' infra/.env.prod.example backend/.env.example | sort -u
```

Expected: a unique list of variable names with no secret values printed.

- [ ] **Step 2: Transfer the repository while excluding credentials and generated files**

```bash
SSHPASS="$SSHPASS" rsync -az --delete \
  --exclude '.git/' --exclude 'node_modules/' --exclude '.env' --exclude '.env.*' \
  --exclude 'coverage/' --exclude '.next/' --exclude 'dist/' \
  -e 'ssh -o StrictHostKeyChecking=accept-new' \
  ./ root@84.247.162.192:/opt/smart-qoldau/
```

Expected: `infra/docker-compose.prod.yml`, `backend/`, `admin/`, and `web/` exist on the VPS; no local environment files were copied.

- [ ] **Step 3: Generate and write the server-only configuration over the SSH stream**

Use a local shell script that generates 32-byte base64 values via `openssl rand -base64 32`, prompts for every externally managed provider key (SMTP, LiveKit, and S3 if not using local MinIO), and sends the rendered file to the remote `install -m 0600 /dev/stdin /opt/smart-qoldau/infra/.env`. Set `PUBLIC_API_BASE_URL` and `SITE_URL` to the chosen initial endpoint only after it is defined; retain `TOTP_REQUIRED=true` and `THROTTLE_ENABLED=true` from Compose.

Expected: remote `.env` has mode `600`; `cut -d= -f1 /opt/smart-qoldau/infra/.env` shows all needed keys but no values.

- [ ] **Step 4: Validate Compose interpolation without starting containers**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env config --quiet'
```

Expected: exit code 0 and no unresolved `${VARIABLE}` interpolation errors.

### Task 3: Build and start the SmartQoldau private application stack

**Files:**
- Modify at runtime: Docker images, containers, and named volumes defined by `/opt/smart-qoldau/infra/docker-compose.prod.yml`
- Read: `/opt/smart-qoldau/infra/docker-compose.prod.yml`

**Interfaces:**
- Consumes: validated Compose configuration
- Produces: healthy `postgres`, `redis`, `minio`, `migrate`, `backend`, `admin`, and `web` services

- [ ] **Step 1: Build deployment images on the VPS**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env build'
```

Expected: all three application image builds exit successfully.

- [ ] **Step 2: Start the Compose project in detached mode**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env up -d'
```

Expected: the migration job completes once; long-running services are started.

- [ ] **Step 3: Verify service and migration state**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env ps --all && docker compose -f docker-compose.prod.yml --env-file .env logs --no-color migrate'
```

Expected: `migrate` exited with status 0; postgres, redis, minio, backend, admin, and web are running or healthy.

- [ ] **Step 4: Verify internal health and non-public stateful ports**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'docker ps --format "{{.Names}} {{.Ports}}"; docker inspect smartqoldau-postgres-1 smartqoldau-redis-1 smartqoldau-minio-1 --format "{{range .NetworkSettings.Ports}}{{println .}}{{end}}"'
```

Expected: no host port mappings for postgres, redis, or minio; only the explicitly added edge proxy may publish HTTP/S in a later DNS-backed task.

### Task 4: Publish local Plane through an automatic ngrok HTTPS endpoint

**Files:**
- Create: `~/.config/systemd/user/plane-ngrok.service` on the current local machine
- Read: local ngrok configuration and local Plane listener state

**Interfaces:**
- Consumes: existing local ngrok credential and `http://127.0.0.1:8090`
- Produces: a user-managed ngrok service and its generated public HTTPS URL

- [ ] **Step 1: Verify Plane and ngrok are available locally**

```bash
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8090/ -o /dev/null
ngrok version
ngrok config check
```

Expected: Plane returns an HTTP response and ngrok confirms a valid local configuration without echoing its credential.

- [ ] **Step 2: Install the user service with a loopback-only target**

Create `~/.config/systemd/user/plane-ngrok.service`:

```ini
[Unit]
Description=Plane ngrok HTTPS tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/ngrok http 8090 --log=stdout
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Use the actual result of `command -v ngrok` in `ExecStart`; the target remains port 8090, which ngrok resolves locally.

- [ ] **Step 3: Enable and start the tunnel**

```bash
systemctl --user daemon-reload
systemctl --user enable --now plane-ngrok.service
systemctl --user status --no-pager plane-ngrok.service
```

Expected: service is active. Enable lingering with `loginctl enable-linger erda` if the local OS must keep the tunnel alive after logout.

- [ ] **Step 4: Obtain and validate the assigned public endpoint**

```bash
curl --fail --silent http://127.0.0.1:4040/api/tunnels
curl --fail --silent --show-error --max-time 20 "https://ASSIGNED_NGROK_HOSTNAME/" -o /dev/null
```

Replace `ASSIGNED_NGROK_HOSTNAME` with the HTTPS `public_url` from the first command. Expected: the local API reports one HTTPS tunnel targeting port 8090 and the public request returns an HTTP response.

### Task 5: Record operational verification and rollback actions

**Files:**
- Create: `/opt/smart-qoldau/DEPLOYMENT.md` on the VPS with non-secret operational commands
- Read: Compose status and user-service status

**Interfaces:**
- Consumes: running services
- Produces: reproducible verification and non-destructive rollback instructions

- [ ] **Step 1: Record only non-secret runbook commands**

Include commands for `docker compose ... ps`, `docker compose ... logs --tail=200 backend`, `docker compose ... restart backend`, the ngrok tunnel API URL, and the warning that automatic ngrok hostnames can change after a restart. Do not include any `.env` values, passwords, access tokens, or generated URLs that contain credentials.

- [ ] **Step 2: Perform final evidence checks**

```bash
sshpass -e ssh -o StrictHostKeyChecking=accept-new root@84.247.162.192 \
  'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env ps --all'
systemctl --user is-active plane-ngrok.service
curl --fail --silent http://127.0.0.1:4040/api/tunnels
```

Expected: Compose reports a successful migration and running long-lived services; the local service is `active`; the ngrok API reports one HTTPS endpoint.

- [ ] **Step 3: Document non-destructive rollback commands**

```bash
ssh root@84.247.162.192 'cd /opt/smart-qoldau/infra && docker compose -f docker-compose.prod.yml --env-file .env down'
systemctl --user disable --now plane-ngrok.service
```

Expected: application containers or the tunnel stop, while Docker volumes and the local Plane service remain intact.
