#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly CADDYFILE="$(cd -- "$SCRIPT_DIR/.." && pwd -P)/Caddyfile.prod"
readonly CADDY_IMAGE='caddy:2.10.2-alpine'
readonly DNS_NAME_RE='^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
readonly IPV4_LIKE_RE='^([0-9]{1,3}\.){3}[0-9]{1,3}$'

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

declare -A seen=()
for variable in WEB_HOSTNAME API_HOSTNAME ADMIN_HOSTNAME; do
  value="${!variable-}"
  [[ -n "$value" ]] || fail "$variable must be exported and non-empty"
  (( ${#value} <= 253 )) || fail "$variable exceeds the 253-character DNS limit"
  [[ "$value" =~ $DNS_NAME_RE ]] \
    || fail "$variable must be a hostname with valid DNS labels and no scheme, port, path, wildcard, or userinfo"
  [[ ! "$value" =~ $IPV4_LIKE_RE ]] || fail "$variable must be a DNS hostname, not an IP address"

  normalized="${value,,}"
  [[ -z "${seen[$normalized]+x}" ]] || fail 'WEB_HOSTNAME, API_HOSTNAME, and ADMIN_HOSTNAME must be distinct'
  seen[$normalized]="$variable"
done

[[ -f "$CADDYFILE" ]] || fail "missing Caddyfile: $CADDYFILE"

# Provision the exact checked-in Caddyfile with the pinned production image.
# The container has no network, so validation cannot contact ACME or DNS.
docker run --rm \
  --network none \
  --read-only \
  --tmpfs /data \
  --tmpfs /config \
  --env WEB_HOSTNAME \
  --env API_HOSTNAME \
  --env ADMIN_HOSTNAME \
  --volume "$CADDYFILE:/etc/caddy/Caddyfile:ro" \
  "$CADDY_IMAGE" \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

printf 'PASS: distinct DNS hostnames and Caddy configuration are valid\n'
