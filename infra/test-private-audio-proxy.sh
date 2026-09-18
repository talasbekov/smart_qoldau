#!/bin/sh
set -eu

infra_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
project_root=$(CDPATH= cd -- "$infra_dir/.." && pwd -P)
project_name="qoldau-e13-proxy-test-$$"
signed_url_file="/tmp/${project_name}-signed-url"
proxy_port=${E13_PROXY_PORT:-18080}
minio_port=${E13_MINIO_PORT:-19000}

export E13_PROXY_PORT="$proxy_port"
export E13_MINIO_PORT="$minio_port"
export E13_SIGNED_URL_FILE="$signed_url_file"
export PROJECT_ROOT="$project_root"
export POSTGRES_USER=e13fixture
export POSTGRES_PASSWORD=e13fixturepass
export POSTGRES_DB=e13fixture
export S3_ACCESS_KEY=e13-access-key
export S3_SECRET_KEY=e13-secret-key-change-me
export S3_BUCKET_CONTENT=sq-content-e13
export STAND_URL="http://127.0.0.1:${proxy_port}"
export PUBLIC_API_BASE_URL="$STAND_URL/v1"

compose() {
  docker compose \
    --project-name "$project_name" \
    --project-directory "$infra_dir" \
    -f "$infra_dir/docker-compose.prod.yml" \
    -f "$infra_dir/docker-compose.stand.yml" \
    -f "$infra_dir/docker-compose.private-audio-test.yml" \
    "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  if [ -e "$signed_url_file" ]; then unlink "$signed_url_file"; fi
}
trap cleanup EXIT HUP INT TERM

if [ ! -d "$project_root/backend/node_modules/@aws-sdk/client-s3" ]; then
  echo 'backend dependencies are missing; run npm ci in backend first' >&2
  exit 1
fi
if ss -ltn | grep -Eq ":(${proxy_port}|${minio_port})[[:space:]]"; then
  echo 'private audio proxy test port is already in use' >&2
  exit 1
fi

compose config --quiet
set +e
invalid_output=$(compose run --rm --no-deps \
  -e S3_BUCKET_CONTENT=Bad_Bucket proxy 2>&1)
invalid_status=$?
set -e
if [ "$invalid_status" -eq 0 ] ||
  ! printf '%s\n' "$invalid_output" |
    grep -Fq 'S3_BUCKET_CONTENT must be a 3-63 character lowercase S3 bucket name'; then
  echo 'invalid stand bucket did not fail in the stock nginx entrypoint' >&2
  printf '%s\n' "$invalid_output" >&2
  exit 1
fi
echo 'invalid_bucket_rejected_by_entrypoint=true'

compose up -d --no-deps minio
attempt=0
until curl -fsS "http://127.0.0.1:${minio_port}/minio/health/ready" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    compose logs --no-color minio >&2
    exit 1
  fi
  sleep 1
done

compose up -d --no-deps proxy
attempt=0
until curl -sS "http://127.0.0.1:${proxy_port}/" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    compose logs --no-color proxy >&2
    exit 1
  fi
  sleep 1
done

compose exec -T proxy nginx -t
startup_logs=$(compose logs --no-color proxy 2>&1)
if ! printf '%s\n' "$startup_logs" |
  grep -Fq 'Running envsubst on /etc/nginx/templates/default.conf.template'; then
  echo 'stock nginx entrypoint did not render the stand template' >&2
  exit 1
fi
compose exec -T proxy grep -F "location ^~ /${S3_BUCKET_CONTENT}/" /etc/nginx/conf.d/default.conf >/dev/null
echo 'stock_entrypoint_envsubst=true'
node "$infra_dir/private-audio-proxy.spec.cjs" healthy

healthy_logs=$(compose logs --no-color proxy 2>&1)
if printf '%s\n' "$healthy_logs" | grep -Eq 'X-Amz-|Credential=|Signature='; then
  echo 'healthy proxy logs contain presigned query material' >&2
  exit 1
fi
if ! printf '%s\n' "$healthy_logs" | grep -Fq '"GET / HTTP/1.1"'; then
  echo 'non-bearer proxy logging was unexpectedly disabled' >&2
  exit 1
fi
echo 'healthy_proxy_logs_contain_signature=false'
echo 'non_bearer_proxy_logging_active=true'

compose exec -T minio sh -ec 'kill "$(cat /tmp/minio.pid)"'
attempt=0
while curl -fsS "http://127.0.0.1:${minio_port}/minio/health/ready" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo 'MinIO child did not stop' >&2
    exit 1
  fi
  sleep 1
done
node "$infra_dir/private-audio-proxy.spec.cjs" upstream-failure
failure_logs=$(compose logs --no-color proxy 2>&1)
if printf '%s\n' "$failure_logs" | grep -Eq 'X-Amz-|Credential=|Signature='; then
  echo 'upstream-failure proxy logs contain presigned query material' >&2
  exit 1
fi
echo 'upstream_failure_proxy_logs_contain_signature=false'

# Restore the real MinIO child for authenticated bucket-isolation checks.
compose restart minio >/dev/null
attempt=0
until curl -fsS "http://127.0.0.1:${minio_port}/minio/health/ready" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    compose logs --no-color minio >&2
    exit 1
  fi
  sleep 1
done
node "$infra_dir/private-audio-proxy.spec.cjs" isolation

# Bounded mutation control: widening only the rendered object location to a
# wildcard must expose the correctly signed other-bucket object. Traversal
# mutations retain a query signed for the original URI, so their S3 response
# is an expected signature/canonical-URI rejection with an x-amz-request-id;
# the production literal route returns the deterministic non-S3 catch-all 502.
compose exec -T proxy sed -i \
  "s|location ^~ /${S3_BUCKET_CONTENT}/ {|location ~ ^/[^/]+/ {|" \
  /etc/nginx/conf.d/default.conf
compose exec -T proxy nginx -t
compose exec -T proxy nginx -s reload
E13_EXPECT_WILDCARD=true node "$infra_dir/private-audio-proxy.spec.cjs" isolation
echo 'wildcard_route_negative_control_detected=true'
