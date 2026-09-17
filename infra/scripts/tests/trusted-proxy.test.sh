#!/usr/bin/env bash
# Disposable, local-only Caddy -> real backend bootstrap forwarding contract.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sq-e30-proxy.XXXXXX")"
PROJECT="sq-e30-$(basename "$WORK" | tr '[:upper:]' '[:lower:]' | tr -d '.')"
export E30_ROOT="$ROOT" E30_WORK="$WORK" E30_PEER=''
cleanup() {
  if [[ -f "$WORK/compose.yml" ]]; then
    docker compose -p "$PROJECT" -f "$WORK/compose.yml" down --volumes --remove-orphans >/dev/null 2>&1 || {
      printf 'Fixture cleanup failed: project=%s work=%s\n' "$PROJECT" "$WORK" >&2
      return 1
    }
  fi
  rm -rf -- "$WORK"
}
trap cleanup EXIT
# Never fetch images, start production services, publish ports, or read .env.
docker image inspect caddy:2.10.2-alpine node:22-alpine >/dev/null
[[ -d "$ROOT/backend/node_modules" ]] || { echo 'Install backend dependencies first' >&2; exit 1; }
cat > "$WORK/compose.yml" <<'YAML'
services:
  proxy:
    image: caddy:2.10.2-alpine
    environment:
      WEB_HOSTNAME: web.fixture.localhost
      API_HOSTNAME: api.fixture.localhost
      ADMIN_HOSTNAME: admin.fixture.localhost
    volumes:
      - ${E30_ROOT}/infra/Caddyfile.prod:/etc/caddy/Caddyfile:ro
    networks: [fixture]
  backend:
    image: node:22-alpine
    working_dir: /backend
    command: ['node', '-r', 'ts-node/register/transpile-only', '/fixture/server.js']
    environment:
      NODE_PATH: /backend/node_modules
      SWAGGER_ENABLED: 'false'
      TRUSTED_PROXY_IPS: ${E30_PEER}
    volumes:
      - ${E30_ROOT}/backend:/backend:ro
      - ${E30_WORK}:/fixture:ro
    networks:
      fixture:
        aliases: [web, admin]
  client:
    image: node:22-alpine
    command: ['node', '/fixture/client.js']
    volumes:
      - ${E30_WORK}:/fixture:ro
    networks: [fixture]
networks:
  fixture:
    internal: true
YAML
cat > "$WORK/server.js" <<'JS'
const { Module, Controller, Get, Req, UseGuards } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ThrottlerModule } = require('@nestjs/throttler');
const { IpThrottlerGuard } = require('/backend/src/common/throttle/throttle.guards');
const { configureApp } = require('/backend/src/bootstrap');
class Probe {
  probe(req) {
    return { ip: req.ip, peer: req.socket.remoteAddress,
      xff: req.headers['x-forwarded-for'], hostname: req.hostname, protocol: req.protocol };
  }
  limited() { return { ok: true }; }
}
Controller()(Probe);
Get('probe')(Probe.prototype, 'probe', Object.getOwnPropertyDescriptor(Probe.prototype, 'probe'));
Req()(Probe.prototype, 'probe', 0);
Get('limited')(Probe.prototype, 'limited', Object.getOwnPropertyDescriptor(Probe.prototype, 'limited'));
UseGuards(IpThrottlerGuard)(Probe.prototype, 'limited', Object.getOwnPropertyDescriptor(Probe.prototype, 'limited'));
class FixtureModule {}
Module({ imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
  controllers: [Probe], providers: [IpThrottlerGuard] })(FixtureModule);
(async () => {
  const app = await NestFactory.create(FixtureModule, { logger: false });
  configureApp(app);
  await app.listen(3000, '0.0.0.0');
})();
JS
cat > "$WORK/client.js" <<'JS'
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
async function send(proxied, headers = {}, path = '/v1/probe', status = 200) {
  return new Promise((resolve, reject) => {
    const req = (proxied ? https : http).get({
      hostname: proxied ? 'proxy' : 'backend', port: proxied ? 443 : 3000,
      servername: 'api.fixture.localhost', rejectUnauthorized: false,
      path, headers: { Host: 'api.fixture.localhost', ...headers },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { assert.equal(res.statusCode, status); resolve(JSON.parse(data)); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
  });
}
(async () => {
  let baseline;
  for (let i = 0; i < 60; i++) {
    try { baseline = await send(true); break; }
    catch (error) { if (i === 59) throw error; await new Promise(r => setTimeout(r, 250)); }
  }
  const normalize = ip => ip.replace(/^::ffff:/, '');
  const direct = await send(false);
  assert.equal(baseline.ip, normalize(direct.peer));
  assert.equal(baseline.xff, normalize(direct.peer));
  assert.notEqual(normalize(baseline.peer), baseline.ip);
  for (const xff of ['203.0.113.99', '203.0.113.99, 198.51.100.8', '::ffff:203.0.113.99']) {
    const spoof = { 'X-Forwarded-For': xff, 'X-Forwarded-Host': 'spoof.invalid', 'X-Forwarded-Proto': 'http' };
    const proxied = await send(true, spoof);
    assert.equal(proxied.ip, baseline.ip);
    assert.equal(proxied.xff, baseline.xff);
    assert.equal(proxied.hostname, 'api.fixture.localhost');
    assert.equal(proxied.protocol, 'https');
    const untrusted = await send(false, spoof);
    assert.equal(untrusted.ip, direct.peer);
    assert.equal(untrusted.hostname, 'api.fixture.localhost');
    assert.equal(untrusted.protocol, 'http');
  }
  await send(true, { 'X-Forwarded-For': '203.0.113.1' }, '/v1/limited');
  await send(true, { 'X-Forwarded-For': '203.0.113.2' }, '/v1/limited');
  const limited = await send(true, { 'X-Forwarded-For': '203.0.113.3' }, '/v1/limited', 429);
  assert.equal(limited.error.code, 'RATE_LIMITED');
  // A second concurrently alive client must have a separate actual socket IP.
  if (process.env.FIRST_IP) assert.notEqual(baseline.ip, process.env.FIRST_IP);
  console.log(baseline.ip);
  if (process.env.HOLD) {
    fs.writeFileSync('/tmp/ready', baseline.ip);
    setInterval(() => {}, 1000);
  }
})().catch(error => { console.error(error); process.exit(1); });
JS

docker compose -p "$PROJECT" -f "$WORK/compose.yml" up -d --pull never proxy >/dev/null
proxy_id="$(docker compose -p "$PROJECT" -f "$WORK/compose.yml" ps -q proxy)"
E30_PEER="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$proxy_id")"
export E30_PEER
[[ -n "$E30_PEER" ]]
docker compose -p "$PROJECT" -f "$WORK/compose.yml" up -d --pull never backend >/dev/null
first_id="$(docker compose -p "$PROJECT" -f "$WORK/compose.yml" run -d --no-deps --pull never -e HOLD=1 client)"
first_ip=''
for ((i=0; i<60; i++)); do
  if first_ip="$(docker exec "$first_id" cat /tmp/ready 2>/dev/null)"; then break; fi
  sleep 0.25
done
[[ -n "$first_ip" ]] || { docker logs "$first_id"; exit 1; }
second_ip="$(docker compose -p "$PROJECT" -f "$WORK/compose.yml" run --rm --no-deps --pull never -e "FIRST_IP=$first_ip" client)"
printf 'PASS: Caddy sanitizes XFF/host/proto; exact trusted peer; direct spoof rejected; independent throttle buckets for clients %s / %s\n' "$first_ip" "$second_ip"
