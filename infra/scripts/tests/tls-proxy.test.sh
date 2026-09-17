#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly INFRA_DIR="$(cd -- "$TEST_DIR/../.." && pwd -P)"
readonly BASE_COMPOSE="$INFRA_DIR/docker-compose.prod.yml"
readonly TLS_COMPOSE="$INFRA_DIR/docker-compose.tls.yml"
readonly CADDYFILE="$INFRA_DIR/Caddyfile.prod"
readonly PREFLIGHT="$INFRA_DIR/scripts/tls-proxy-preflight.sh"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-tls-proxy.XXXXXX")"
readonly PROJECT="sq-tls-fixture-$$"
readonly FIXTURE_ENV="$WORK_DIR/fixture.env"
readonly RESOLVED_COMPOSE="$WORK_DIR/resolved.json"
readonly FIXTURE_COMPOSE="$WORK_DIR/fixture.compose.yml"
readonly FIXTURE_SERVER="$WORK_DIR/server.js"

cleanup() {
  docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

diagnose_error() {
  local status="$?"
  if [[ -f "$FIXTURE_COMPOSE" ]]; then
    docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" ps >&2 || true
    docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" logs --no-color >&2 || true
  fi
  return "$status"
}
trap diagnose_error ERR

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

for required in "$TLS_COMPOSE" "$CADDYFILE" "$PREFLIGHT"; do
  [[ -f "$required" ]] || fail "missing production TLS artifact: $required"
done

expect_preflight_rejection() {
  local web_hostname="$1"
  local api_hostname="$2"
  local admin_hostname="$3"
  if WEB_HOSTNAME="$web_hostname" API_HOSTNAME="$api_hostname" ADMIN_HOSTNAME="$admin_hostname" \
    "$PREFLIGHT" >"$WORK_DIR/preflight.out" 2>"$WORK_DIR/preflight.err"; then
    fail "preflight accepted invalid hostnames: $web_hostname, $api_hostname, $admin_hostname"
  fi
}

expect_preflight_rejection 'https://web.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'web.fixture.invalid:443' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'web.fixture.invalid/private' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection '*.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'user@web.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection '-web.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'web_.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.fixture.invalid' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection '127.0.0.1' 'api.fixture.invalid' 'admin.fixture.invalid'
expect_preflight_rejection 'web.fixture.invalid' 'WEB.fixture.invalid' 'admin.fixture.invalid'

# A valid call must provision the checked-in config with the pinned Caddy image,
# not merely parse YAML or duplicate Caddy's parser in the test.
WEB_HOSTNAME=web.fixture.invalid \
API_HOSTNAME=api.fixture.invalid \
ADMIN_HOSTNAME=admin.fixture.invalid \
  "$PREFLIGHT"

cat >"$FIXTURE_ENV" <<'ENV'
POSTGRES_USER=fixture_user
POSTGRES_PASSWORD=fixture_password
POSTGRES_DB=fixture_db
S3_ACCESS_KEY=fixture_access_key
S3_SECRET_KEY=fixture_secret_key
PUBLIC_API_BASE_URL=https://api.fixture.invalid/v1
SITE_URL=https://web.fixture.invalid
BACKEND_IMAGE=fixture/backend:latest
ADMIN_IMAGE=fixture/admin:latest
WEB_IMAGE=fixture/web:latest
WEB_HOSTNAME=web.fixture.invalid
API_HOSTNAME=api.fixture.invalid
ADMIN_HOSTNAME=admin.fixture.invalid
ENV

# Resolve disposable copies so the production backend never reads a real .env.
cp -- "$BASE_COMPOSE" "$WORK_DIR/docker-compose.prod.yml"
cp -- "$TLS_COMPOSE" "$WORK_DIR/docker-compose.tls.yml"
cp -- "$CADDYFILE" "$WORK_DIR/Caddyfile.prod"
sed -i "s|env_file: \[.env\]|env_file: [$FIXTURE_ENV]|" "$WORK_DIR/docker-compose.prod.yml"

docker compose --project-directory "$WORK_DIR" --env-file "$FIXTURE_ENV" \
  -f "$WORK_DIR/docker-compose.prod.yml" \
  -f "$WORK_DIR/docker-compose.tls.yml" \
  config --format json >"$RESOLVED_COMPOSE"

python3 - "$RESOLVED_COMPOSE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    compose = json.load(stream)

services = compose.get("services", {})
expected = {"postgres", "redis", "minio", "migrate", "backend", "admin", "web", "proxy"}
if set(services) != expected:
    raise SystemExit(f"unexpected services: {sorted(services)}")

for name, service in services.items():
    logging = service.get("logging")
    want = {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}}
    if logging != want:
        raise SystemExit(f"{name} has unbounded or unexpected logging: {logging!r}")
    if name != "proxy" and "ports" in service:
        raise SystemExit(f"{name} unexpectedly publishes ports: {service['ports']!r}")

proxy = services["proxy"]
if proxy.get("image") != "caddy:2.10.2-alpine":
    raise SystemExit(f"proxy image is not pinned: {proxy.get('image')!r}")
if sorted(proxy.get("networks", {})) != ["edge"]:
    raise SystemExit(f"proxy escaped edge network: {proxy.get('networks')!r}")
if sorted(proxy.get("depends_on", {})) != ["admin", "backend", "web"]:
    raise SystemExit(f"proxy dependencies changed: {proxy.get('depends_on')!r}")

ports = {
    (int(item["target"]), item.get("protocol", "tcp"), int(item["published"]))
    for item in proxy.get("ports", [])
}
want_ports = {(80, "tcp", 80), (443, "tcp", 443), (443, "udp", 443)}
if ports != want_ports:
    raise SystemExit(f"unexpected public proxy ports: {sorted(ports)!r}")

environment = proxy.get("environment", {})
want_environment = {
    "WEB_HOSTNAME": "web.fixture.invalid",
    "API_HOSTNAME": "api.fixture.invalid",
    "ADMIN_HOSTNAME": "admin.fixture.invalid",
}
if environment != want_environment:
    raise SystemExit(f"operator hostnames were not propagated exactly: {environment!r}")

mounts = {
    (item["type"], item["target"], bool(item.get("read_only", False)))
    for item in proxy.get("volumes", [])
}
want_mounts = {
    ("bind", "/etc/caddy/Caddyfile", True),
    ("volume", "/data", False),
    ("volume", "/config", False),
}
if mounts != want_mounts:
    raise SystemExit(f"unexpected proxy mounts: {sorted(mounts)!r}")

if sorted(compose.get("volumes", {})) != [
    "caddy_config",
    "caddy_data",
    "miniodata",
    "pgdata",
    "redisdata",
]:
    raise SystemExit(f"certificate volumes missing or topology changed: {compose.get('volumes')!r}")
PY

# Three tiny upstreams exercise the checked-in Caddyfile without starting the
# application, databases, migrations, or shared production containers.
cat >"$FIXTURE_SERVER" <<'JS'
const crypto = require('node:crypto');
const http = require('node:http');

const name = process.argv[2];
const server = http.createServer((request, response) => {
  response.setHeader('x-fixture', name);
  response.end(`${name}:${request.url}`);
});

server.on('upgrade', (request, socket) => {
  if (name !== 'backend' || !request.url.startsWith('/socket.io/')) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  const queryPreserved = request.url.includes('auth=ws_query_secret_');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Connection: Upgrade',
    'Upgrade: websocket',
    `Sec-WebSocket-Accept: ${accept}`,
    'X-Fixture: backend',
    `X-Upstream-Query-Preserved: ${queryPreserved}`,
    '',
    '',
  ].join('\r\n'));
  setTimeout(() => socket.end(), 250);
});

server.listen(name === 'admin' ? 80 : 3000, '0.0.0.0');
JS

cat >"$FIXTURE_COMPOSE" <<YAML
services:
  backend:
    image: node:24-alpine
    command: ["node", "/fixture/server.js", "backend"]
    volumes:
      - "$FIXTURE_SERVER:/fixture/server.js:ro"
    networks: [edge]
    labels:
      io.smartqoldau.fixture: "$PROJECT"
  web:
    image: node:24-alpine
    command: ["node", "/fixture/server.js", "web"]
    volumes:
      - "$FIXTURE_SERVER:/fixture/server.js:ro"
    networks: [edge]
    labels:
      io.smartqoldau.fixture: "$PROJECT"
  admin:
    image: node:24-alpine
    command: ["node", "/fixture/server.js", "admin"]
    volumes:
      - "$FIXTURE_SERVER:/fixture/server.js:ro"
    networks: [edge]
    labels:
      io.smartqoldau.fixture: "$PROJECT"
  proxy:
    image: caddy:2.10.2-alpine
    environment:
      WEB_HOSTNAME: web.fixture.localhost
      API_HOSTNAME: api.fixture.localhost
      ADMIN_HOSTNAME: admin.fixture.localhost
    ports:
      - "127.0.0.1::80"
      - "127.0.0.1::443"
    volumes:
      - "$CADDYFILE:/etc/caddy/Caddyfile:ro"
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [backend, admin, web]
    networks: [edge]
    labels:
      io.smartqoldau.fixture: "$PROJECT"
volumes:
  caddy_data:
    labels:
      io.smartqoldau.fixture: "$PROJECT"
  caddy_config:
    labels:
      io.smartqoldau.fixture: "$PROJECT"
networks:
  edge:
    labels:
      io.smartqoldau.fixture: "$PROJECT"
YAML

docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" up -d --wait

for private_endpoint in backend:3000 web:3000 admin:80; do
  private_service="${private_endpoint%%:*}"
  private_port="${private_endpoint##*:}"
  if docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" port "$private_service" "$private_port" 2>/dev/null | grep -q .; then
    fail "$private_service fixture unexpectedly publishes its upstream port"
  fi
done

HTTPS_ENDPOINT="$(docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" port proxy 443)"
HTTPS_PORT="${HTTPS_ENDPOINT##*:}"
[[ "$HTTPS_PORT" =~ ^[0-9]+$ ]] || fail "could not resolve fixture HTTPS port: $HTTPS_ENDPOINT"
HTTP_ENDPOINT="$(docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" port proxy 80)"
HTTP_PORT="${HTTP_ENDPOINT##*:}"
[[ "$HTTP_PORT" =~ ^[0-9]+$ ]] || fail "could not resolve fixture HTTP port: $HTTP_ENDPOINT"

assert_route() {
  local hostname="$1"
  local path="$2"
  local expected="$3"
  local body
  body="$(curl --fail --silent --show-error --insecure \
    --resolve "$hostname:$HTTPS_PORT:127.0.0.1" \
    "https://$hostname:$HTTPS_PORT$path")"
  [[ "$body" == "$expected" ]] || fail "$hostname$path routed as '$body', want '$expected'"
}

readonly WEB_QUERY_SECRET="web_query_secret_$$"
readonly API_QUERY_SECRET="api_query_secret_$$"
readonly ADMIN_QUERY_SECRET="admin_query_secret_$$"
readonly WS_QUERY_SECRET="ws_query_secret_$$"
readonly ERROR_QUERY_SECRET="error_query_secret_$$"
readonly REDIRECT_QUERY_SECRET="redirect_query_secret_$$"

redirect_status="$(curl --silent --show-error --output /dev/null \
  --dump-header "$WORK_DIR/redirect.headers" \
  --write-out '%{http_code}' \
  --header 'Host: web.fixture.localhost' \
  "http://127.0.0.1:$HTTP_PORT/?token=$REDIRECT_QUERY_SECRET")"
[[ "$redirect_status" == '308' ]] || fail "HTTP redirect returned $redirect_status, want 308"
redirect_location="$(tr -d '\r' <"$WORK_DIR/redirect.headers" | awk 'tolower($1) == "location:" { print $2 }')"
expected_location="https://web.fixture.localhost/?token=$REDIRECT_QUERY_SECRET"
[[ "$redirect_location" == "$expected_location" ]] \
  || fail "client redirect was '$redirect_location', want '$expected_location'"

assert_route web.fixture.localhost "/hello?review_token=$WEB_QUERY_SECRET" \
  "web:/hello?review_token=$WEB_QUERY_SECRET"
assert_route api.fixture.localhost "/v1/health?access_token=$API_QUERY_SECRET" \
  "backend:/v1/health?access_token=$API_QUERY_SECRET"
assert_route admin.fixture.localhost "/verification?code=$ADMIN_QUERY_SECRET" \
  "admin:/verification?code=$ADMIN_QUERY_SECRET"

python3 - "$HTTPS_PORT" "$WS_QUERY_SECRET" <<'PY'
import socket
import ssl
import sys

port = int(sys.argv[1])
secret = sys.argv[2]
hostname = "web.fixture.localhost"
context = ssl._create_unverified_context()
with socket.create_connection(("127.0.0.1", port), timeout=5) as raw:
    with context.wrap_socket(raw, server_hostname=hostname) as stream:
        stream.sendall(
            (
                f"GET /socket.io/?EIO=4&transport=websocket&auth={secret} HTTP/1.1\r\n"
                f"Host: {hostname}\r\n"
                "Connection: Upgrade\r\n"
                "Upgrade: websocket\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
                "\r\n"
            ).encode("ascii")
        )
        response = stream.recv(4096).decode("latin-1")

if not response.startswith("HTTP/1.1 101 "):
    raise SystemExit(f"websocket upgrade was not proxied: {response!r}")
if "\r\nX-Fixture: backend\r\n" not in response:
    raise SystemExit(f"websocket reached the wrong upstream: {response!r}")
if "\r\nX-Upstream-Query-Preserved: true\r\n" not in response:
    raise SystemExit(f"websocket query did not reach the upstream: {response!r}")
PY

# Exercise the reverse-proxy error logger as well as successful access logs.
docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" stop admin >/dev/null
error_status="$(curl --silent --show-error --insecure --output /dev/null --write-out '%{http_code}' \
  --resolve "admin.fixture.localhost:$HTTPS_PORT:127.0.0.1" \
  "https://admin.fixture.localhost:$HTTPS_PORT/verification?code=$ERROR_QUERY_SECRET")"
[[ "$error_status" == '502' ]] || fail "stopped admin upstream returned $error_status, want 502"

docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" logs --no-color --no-log-prefix proxy >"$WORK_DIR/proxy.log"
for secret in \
  "$WEB_QUERY_SECRET" \
  "$API_QUERY_SECRET" \
  "$ADMIN_QUERY_SECRET" \
  "$WS_QUERY_SECRET" \
  "$ERROR_QUERY_SECRET" \
  "$REDIRECT_QUERY_SECRET"; do
  if grep -Fq -- "$secret" "$WORK_DIR/proxy.log"; then
    fail "query secret leaked into Caddy logs: $secret"
  fi
done
redacted_count="$(grep -Fo -- '?REDACTED' "$WORK_DIR/proxy.log" | wc -l)"
(( redacted_count >= 7 )) || fail "expected redacted request and redirect fields, found $redacted_count"
python3 - "$WORK_DIR/proxy.log" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    records = [json.loads(line) for line in stream if line.strip()]

def is_redacted_failure(record, logger):
    return (
        record.get("logger", "").startswith(logger)
        and record.get("status") == 502
        and record.get("request", {}).get("uri") == "/verification?REDACTED"
    )

if not any(is_redacted_failure(record, "http.log.error") for record in records):
    raise SystemExit("reverse-proxy runtime error log was not query-redacted")
if not any(is_redacted_failure(record, "http.log.access") for record in records):
    raise SystemExit("502 access log was not query-redacted")

successful = {
    (record.get("status"), record.get("request", {}).get("uri"))
    for record in records
    if record.get("logger", "").startswith("http.log.access")
}
for expected in {
    (308, "/?REDACTED"),
    (200, "/hello?REDACTED"),
    (200, "/v1/health?REDACTED"),
    (200, "/verification?REDACTED"),
    (101, "/socket.io/?REDACTED"),
}:
    if expected not in successful:
        raise SystemExit(f"missing redacted successful access log: {expected!r}")

redirect_locations = {
    location
    for record in records
    if record.get("status") == 308
    for location in record.get("resp_headers", {}).get("Location", [])
}
if redirect_locations != {"https://web.fixture.localhost/?REDACTED"}:
    raise SystemExit(f"redirect Location was not query-redacted in logs: {redirect_locations!r}")
PY

# The documented rollback stops and removes only proxy. Named certificate
# state remains, the former host port stops accepting connections, and the
# unrelated upstreams remain running.
PROXY_CONTAINER="$(docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" ps -q proxy)"
CADDY_DATA_VOLUME="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$PROXY_CONTAINER")"
CADDY_CONFIG_VOLUME="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/config"}}{{.Name}}{{end}}{{end}}' "$PROXY_CONTAINER")"
[[ -n "$CADDY_DATA_VOLUME" && -n "$CADDY_CONFIG_VOLUME" ]] || fail 'could not capture Caddy volume names before rollback'
docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" stop proxy >/dev/null
docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" rm --force proxy >/dev/null
[[ -z "$(docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" ps -aq proxy)" ]] \
  || fail 'proxy container remains after bounded rollback'
docker volume inspect "$CADDY_DATA_VOLUME" "$CADDY_CONFIG_VOLUME" >/dev/null
for survivor in backend web; do
  [[ -n "$(docker compose -p "$PROJECT" -f "$FIXTURE_COMPOSE" ps -q --status running "$survivor")" ]] \
    || fail "$survivor was affected by proxy-only rollback"
done
python3 - "$HTTPS_PORT" <<'PY'
import socket
import sys

port = int(sys.argv[1])
with socket.socket() as stream:
    stream.settimeout(1)
    if stream.connect_ex(("127.0.0.1", port)) == 0:
        raise SystemExit(f"proxy rollback left HTTPS port {port} accepting connections")
PY

printf 'PASS: TLS routes, private logs, hostname preflight, isolation, and rollback\n'
