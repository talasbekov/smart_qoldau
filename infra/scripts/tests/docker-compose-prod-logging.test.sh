#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly INFRA_DIR="$(cd -- "$TEST_DIR/../.." && pwd -P)"
readonly SOURCE_COMPOSE="$INFRA_DIR/docker-compose.prod.yml"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-compose-logging.XXXXXX")"
readonly FIXTURE_ENV="$WORK_DIR/fixture.env"
readonly FIXTURE_COMPOSE="$WORK_DIR/docker-compose.prod.yml"

cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

cat >"$FIXTURE_ENV" <<'ENV'
POSTGRES_USER=fixture_user
POSTGRES_PASSWORD=fixture_password
POSTGRES_DB=fixture_db
S3_ACCESS_KEY=fixture_access_key
S3_SECRET_KEY=fixture_secret_key
PUBLIC_API_BASE_URL=https://api.fixture.invalid/v1
SITE_URL=https://fixture.invalid
BACKEND_IMAGE=fixture/backend:latest
ADMIN_IMAGE=fixture/admin:latest
WEB_IMAGE=fixture/web:latest
ENV

# `backend` intentionally reads `.env` through `env_file`; substitute it only
# in this disposable copy so validation never reads a real deployment env file.
cp -- "$SOURCE_COMPOSE" "$FIXTURE_COMPOSE"
sed -i "s|env_file: \[.env\]|env_file: [$FIXTURE_ENV]|" "$FIXTURE_COMPOSE"

docker compose --project-directory "$WORK_DIR" --env-file "$FIXTURE_ENV" \
  -f "$FIXTURE_COMPOSE" config --format json >"$WORK_DIR/resolved.json"

python3 - "$WORK_DIR/resolved.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    compose = json.load(stream)

services = compose.get("services", {})
expected_services = {"postgres", "redis", "minio", "migrate", "backend", "admin", "web"}
if set(services) != expected_services:
    raise SystemExit(f"unexpected services: {sorted(services)}")

for name, service in services.items():
    logging = service.get("logging")
    if logging != {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}}:
        raise SystemExit(f"{name} has unexpected logging: {logging!r}")

expected_networks = {
    "postgres": ["internal"],
    "redis": ["internal"],
    "minio": ["internal"],
    "migrate": ["internal"],
    "backend": ["edge", "internal"],
    "admin": ["edge"],
    "web": ["edge"],
}
for name, networks in expected_networks.items():
    if sorted(services[name].get("networks", {})) != networks:
        raise SystemExit(f"{name} networks changed: {services[name].get('networks')!r}")
    if "ports" in services[name]:
        raise SystemExit(f"{name} unexpectedly publishes ports: {services[name]['ports']!r}")

if services["redis"].get("command") != ["redis-server", "--appendonly", "yes"]:
    raise SystemExit("redis command changed")
if services["migrate"].get("command") != ["npx", "prisma", "migrate", "deploy"]:
    raise SystemExit("migrate command changed")
if services["backend"].get("depends_on", {}).get("migrate", {}).get("condition") != "service_completed_successfully":
    raise SystemExit("backend migration dependency changed")
if sorted(compose.get("volumes", {})) != ["miniodata", "pgdata", "redisdata"]:
    raise SystemExit(f"volumes changed: {compose.get('volumes')!r}")
if compose.get("networks", {}).keys() != {"edge", "internal"}:
    raise SystemExit(f"networks changed: {compose.get('networks')!r}")
PY

printf 'PASS: production compose logging limits and topology\n'
