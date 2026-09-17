#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPTS_DIR="$(cd -- "$TEST_DIR/.." && pwd -P)"
readonly BACKUP_SCRIPT="$SCRIPTS_DIR/minio-backup.sh"
readonly VALIDATE_SCRIPT="$SCRIPTS_DIR/minio-restore-validate.sh"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
readonly OWNER_LABEL="com.smartqoldau.minio-backup-test.run=$RUN_ID"
readonly SOURCE_CONTAINER="smartqoldau-minio-backup-source-$RUN_ID"
readonly SOURCE_VOLUME="smartqoldau-minio-backup-source-$RUN_ID"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-minio-backup-test.XXXXXX")"
readonly BACKUP_DIR="$WORK_DIR/verified-backup"
readonly MINIO_IMAGE_REF="minio/minio:latest"
readonly MINIO_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$MINIO_IMAGE_REF")"
readonly SOURCE_ENDPOINT="http://127.0.0.1:9000"
readonly SOURCE_ACCESS='e30-access'
readonly SOURCE_SECRET='e30:/@%secret+value'
source_container_id=''

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

owned_containers() {
  docker ps --all --quiet --filter "label=$1"
}

cleanup() {
  local status=$?
  if [[ -n "$source_container_id" ]]; then
    local ownership
    ownership="$(docker container inspect --format '{{.Id}}|{{ index .Config.Labels "com.smartqoldau.minio-backup-test.run" }}' "$source_container_id" 2>/dev/null || true)"
    if [[ "$ownership" == "$source_container_id|$RUN_ID" ]]; then
      docker rm --force "$source_container_id" >/dev/null 2>&1 || true
    else
      printf 'Refusing to remove source fixture without exact ID and ownership label\n' >&2
      status=1
    fi
  fi
  local volume_ownership
  volume_ownership="$(docker volume inspect --format '{{ index .Labels "com.smartqoldau.minio-backup-test.run" }}' "$SOURCE_VOLUME" 2>/dev/null || true)"
  if [[ "$volume_ownership" == "$RUN_ID" ]]; then
    docker volume rm "$SOURCE_VOLUME" >/dev/null 2>&1 || status=1
  elif docker volume inspect "$SOURCE_VOLUME" >/dev/null 2>&1; then
    printf 'Refusing to remove source volume without ownership label\n' >&2
    status=1
  fi
  rm -rf -- "$WORK_DIR"
  exit "$status"
}
trap cleanup EXIT

wait_until() {
  local description="$1"
  shift
  local deadline=$((SECONDS + 20))
  until "$@"; do
    (( SECONDS < deadline )) || fail "timed out waiting for $description"
    sleep 0.2
  done
}

source_ready() {
  docker exec "$source_container_id" mc ready local >/dev/null 2>&1
}

source_mc() {
  docker exec --interactive "$source_container_id" sh -ceu '
    config_dir="$(mktemp -d /tmp/smartqoldau-minio-test-mc.XXXXXX)"
    trap "rm -rf -- \"$config_dir\"" EXIT
    printf "%s\n%s\n" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
      | MC_CONFIG_DIR="$config_dir" mc alias set source http://127.0.0.1:9000 \
        --api S3v4 --path auto --quiet >/dev/null
    MC_CONFIG_DIR="$config_dir" mc "$@"
  ' sh "$@"
}

assert_no_owned_runtime() {
  local label="$1"
  local found
  found="$(owned_containers "$label")"
  [[ -z "$found" ]] || fail "owned container leaked for $label: $found"
}

assert_no_source_backup_state() {
  docker exec "$source_container_id" sh -ceu '
    for control_directory in /tmp/smartqoldau-minio-backup-*; do
      [ ! -e "$control_directory" ] || exit 71
    done
    newline="$(printf "\nX")"
    newline="${newline%X}"
    for environment in /proc/[0-9]*/environ; do
      token_environment=""
      if token_environment="$(tr "\0" "\n" <"$environment" 2>/dev/null)"; then
        case "${newline}${token_environment}${newline}" in
          *"${newline}SMARTQOLDAU_MINIO_BACKUP_TOKEN="*) exit 72 ;;
        esac
      fi
    done
  ' || fail 'source retained an owned mirror process, control directory, or credential config'
}

readonly ENDPOINT_PROBE_BIN="$WORK_DIR/endpoint-probe-bin"
readonly ENDPOINT_PROBE_MARKER="$WORK_DIR/endpoint-probe-docker-called"
mkdir -m 700 -- "$ENDPOINT_PROBE_BIN"
printf '%s\n' \
  '#!/bin/sh' \
  'printf called >"$SMARTQOLDAU_ENDPOINT_PROBE_MARKER"' \
  'exit 97' \
  >"$ENDPOINT_PROBE_BIN/docker"
chmod 700 "$ENDPOINT_PROBE_BIN/docker"
for invalid_endpoint in \
  'https://credentials-sink.invalid:9443' \
  'http://minio:9000' \
  'http://127.0.0.1'; do
  if SMARTQOLDAU_ENDPOINT_PROBE_MARKER="$ENDPOINT_PROBE_MARKER" \
    PATH="$ENDPOINT_PROBE_BIN:$PATH" \
    "$BACKUP_SCRIPT" \
      --container selected-source \
      --endpoint "$invalid_endpoint" \
      --target-port 9100 \
      --target-console-port 9101 \
      --minio-image unavailable-image \
      --output "$WORK_DIR/rejected-endpoint" \
      >"$WORK_DIR/rejected-endpoint.log" 2>&1; then
    fail "backup accepted unrelated or implicit-port endpoint: $invalid_endpoint"
  fi
  [[ ! -e "$ENDPOINT_PROBE_MARKER" ]] \
    || fail "backup used Docker before rejecting endpoint: $invalid_endpoint"
done
printf 'PASS: source endpoint is explicit loopback and rejected before Docker use\n'

readonly IMAGE_PROBE_BIN="$WORK_DIR/image-probe-bin"
readonly IMAGE_PROBE_MARKER="$WORK_DIR/image-probe-create-argv"
mkdir -m 700 -- "$IMAGE_PROBE_BIN"
printf '%s\n' \
  '#!/bin/sh' \
  'case "$1:$2" in' \
  '  container:inspect) printf "%s\n" "probe-source-id|true" ;;' \
  '  image:inspect) printf "%s\n" "$SMARTQOLDAU_APPROVED_IMAGE_ID" ;;' \
  '  exec:*) exit 0 ;;' \
  '  create:*) printf "%s\n" "$*" >"$SMARTQOLDAU_IMAGE_PROBE_MARKER"; exit 97 ;;' \
  '  *) exit 97 ;;' \
  'esac' \
  >"$IMAGE_PROBE_BIN/docker"
chmod 700 "$IMAGE_PROBE_BIN/docker"
if SMARTQOLDAU_APPROVED_IMAGE_ID="$MINIO_IMAGE_ID" \
  SMARTQOLDAU_IMAGE_PROBE_MARKER="$IMAGE_PROBE_MARKER" \
  PATH="$IMAGE_PROBE_BIN:$PATH" \
  "$BACKUP_SCRIPT" \
    --container selected-source \
    --endpoint "$SOURCE_ENDPOINT" \
    --target-port 9100 \
    --target-console-port 9101 \
    --minio-image moving-tag \
    --output "$WORK_DIR/image-probe-backup" \
    >"$WORK_DIR/image-probe.log" 2>&1; then
  fail 'image probe unexpectedly completed a backup'
fi
grep --fixed-strings --quiet "$MINIO_IMAGE_ID" "$IMAGE_PROBE_MARKER" \
  || fail 'backup create did not use the inspected immutable image ID'
if grep --fixed-strings --quiet 'moving-tag' "$IMAGE_PROBE_MARKER"; then
  fail 'backup create used the mutable image reference after inspection'
fi
printf 'PASS: backup create uses the inspected immutable image ID\n'

docker volume create --label "$OWNER_LABEL" "$SOURCE_VOLUME" >/dev/null
source_container_id="$(docker run --detach --rm \
  --name "$SOURCE_CONTAINER" \
  --label "$OWNER_LABEL" \
  --network none \
  --env "MINIO_ROOT_USER=$SOURCE_ACCESS" \
  --env "MINIO_ROOT_PASSWORD=$SOURCE_SECRET" \
  --volume "$SOURCE_VOLUME:/data" \
  "$MINIO_IMAGE_ID" server /data)"
wait_until 'source MinIO readiness' source_ready

source_mc mb source/expert-documents source/sq-avatars >/dev/null
printf 'nested verification document\n' >"$WORK_DIR/document.txt"
printf '\x00\xff\x10\x80smart-qoldau\x00\x7f' >"$WORK_DIR/avatar.bin"
source_mc pipe \
  --attr 'Content-Type=text/plain;X-Amz-Meta-Owner=verification-team' \
  source/expert-documents/cases/2026/09/document.txt \
  <"$WORK_DIR/document.txt" >/dev/null
source_mc pipe \
  --attr 'Content-Type=application/octet-stream;X-Amz-Meta-Kind=avatar-binary' \
  source/sq-avatars/nested/user/avatar.bin \
  <"$WORK_DIR/avatar.bin" >/dev/null

document_sha="$(sha256sum "$WORK_DIR/document.txt" | awk '{print $1}')"
avatar_sha="$(sha256sum "$WORK_DIR/avatar.bin" | awk '{print $1}')"
jq -n \
  --arg document_sha "$document_sha" \
  --arg avatar_sha "$avatar_sha" \
  '{objects: [
    {
      bucket: "expert-documents",
      key: "cases/2026/09/document.txt",
      sha256: $document_sha,
      contentType: "text/plain",
      metadata: {"X-Amz-Meta-Owner": "verification-team"}
    },
    {
      bucket: "sq-avatars",
      key: "nested/user/avatar.bin",
      sha256: $avatar_sha,
      contentType: "application/octet-stream",
      metadata: {"X-Amz-Meta-Kind": "avatar-binary"}
    }
  ]}' >"$WORK_DIR/expectations.json"

"$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9100 \
  --target-console-port 9101 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$BACKUP_DIR" \
  >"$WORK_DIR/backup.log" 2>&1 \
  || { sed -n '1,180p' "$WORK_DIR/backup.log" >&2; fail 'initial logical backup failed'; }

[[ -f "$BACKUP_DIR/minio-data.tar" ]] || fail 'backup data archive was not created'
[[ -f "$BACKUP_DIR/manifest.json" ]] || fail 'backup manifest was not created'
[[ -f "$BACKUP_DIR/BUCKETS.jsonl" ]] || fail 'bucket inventory was not created'
[[ -f "$BACKUP_DIR/OBJECTS.jsonl" ]] || fail 'object inventory was not created'
[[ -f "$BACKUP_DIR/SHA256SUMS" ]] || fail 'backup checksum file was not created'
(cd -- "$BACKUP_DIR" && sha256sum --check SHA256SUMS) >/dev/null \
  || fail 'published backup checksum does not verify'
for sensitive_value in \
  "$SOURCE_ACCESS" \
  "$SOURCE_SECRET" \
  'expert-documents' \
  'cases/2026/09/document.txt'; do
  if grep --fixed-strings --quiet "$sensitive_value" "$WORK_DIR/backup.log"; then
    fail 'backup log exposed credentials or object names'
  fi
done
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: atomic logical MinIO backup artifact\n'

rm -f -- "$IMAGE_PROBE_MARKER"
if SMARTQOLDAU_APPROVED_IMAGE_ID="$MINIO_IMAGE_ID" \
  SMARTQOLDAU_IMAGE_PROBE_MARKER="$IMAGE_PROBE_MARKER" \
  PATH="$IMAGE_PROBE_BIN:$PATH" \
  "$VALIDATE_SCRIPT" \
    --backup "$BACKUP_DIR" \
    --minio-image moving-tag \
    --expectations "$WORK_DIR/expectations.json" \
    >"$WORK_DIR/restore-image-probe.log" 2>&1; then
  fail 'restore image probe unexpectedly completed validation'
fi
grep --fixed-strings --quiet "$MINIO_IMAGE_ID" "$IMAGE_PROBE_MARKER" \
  || fail 'restore create did not use the inspected immutable image ID'
if grep --fixed-strings --quiet 'moving-tag' "$IMAGE_PROBE_MARKER"; then
  fail 'restore create used the mutable image reference after inspection'
fi
printf 'PASS: restore create uses the inspected immutable image ID\n'

readonly HANG_DOCKER_BIN="$WORK_DIR/hang-docker-bin"
mkdir -m 700 -- "$HANG_DOCKER_BIN"
printf '%s\n' \
  '#!/bin/sh' \
  'if [ "$1" = cp ]; then' \
  '  printf "%s\n" "$$" >"$SMARTQOLDAU_HANG_MARKER"' \
  '  trap "exit 143" HUP INT TERM' \
  '  while :; do sleep 1; done' \
  'fi' \
  'exec /usr/bin/docker "$@"' \
  >"$HANG_DOCKER_BIN/docker"
chmod 700 "$HANG_DOCKER_BIN/docker"

wait_for_process_exit() {
  local process_id="$1"
  local deadline=$((SECONDS + 8))
  while kill -0 "$process_id" 2>/dev/null; do
    (( SECONDS < deadline )) || return 1
    sleep 0.2
  done
}

force_stop_hang_probe() {
  local parent_pid="$1"
  local marker="$2"
  if [[ -s "$marker" ]]; then
    local child_pid
    child_pid="$(cat "$marker")"
    [[ "$child_pid" =~ ^[0-9]+$ ]] && kill -KILL "$child_pid" 2>/dev/null || true
  fi
  kill -KILL "$parent_pid" 2>/dev/null || true
  wait "$parent_pid" 2>/dev/null || true
}

readonly COLD_COPY_MARKER="$WORK_DIR/cold-copy-hang.pid"
readonly COLD_COPY_BACKUP="$WORK_DIR/cold-copy-interrupted"
SMARTQOLDAU_HANG_MARKER="$COLD_COPY_MARKER" \
PATH="$HANG_DOCKER_BIN:$PATH" \
"$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9700 \
  --target-console-port 9701 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$COLD_COPY_BACKUP" \
  >"$WORK_DIR/cold-copy-interrupted.log" 2>&1 &
cold_copy_pid=$!
wait_until 'cold backup copy hang' test -s "$COLD_COPY_MARKER"
kill -TERM "$cold_copy_pid"
if ! wait_for_process_exit "$cold_copy_pid"; then
  force_stop_hang_probe "$cold_copy_pid" "$COLD_COPY_MARKER"
  fail 'backup TERM remained blocked during cold data copy'
fi
set +e
wait "$cold_copy_pid"
cold_copy_status=$?
set -e
[[ "$cold_copy_status" == '143' ]] \
  || fail "cold-copy backup TERM status was $cold_copy_status, expected 143"
[[ "$(docker container inspect --format '{{.State.Running}}' "$source_container_id")" == 'true' ]] \
  || fail 'cold-copy interruption stopped the source MinIO container'
[[ ! -e "$COLD_COPY_BACKUP" ]] || fail 'cold-copy interruption published an artifact'
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: TERM during cold backup copy is bounded and owned-only\n'

readonly RESTORE_COPY_MARKER="$WORK_DIR/restore-copy-hang.pid"
SMARTQOLDAU_HANG_MARKER="$RESTORE_COPY_MARKER" \
PATH="$HANG_DOCKER_BIN:$PATH" \
"$VALIDATE_SCRIPT" \
  --backup "$BACKUP_DIR" \
  --minio-image "$MINIO_IMAGE_ID" \
  --expectations "$WORK_DIR/expectations.json" \
  >"$WORK_DIR/restore-copy-interrupted.log" 2>&1 &
restore_copy_pid=$!
wait_until 'restore copy hang' test -s "$RESTORE_COPY_MARKER"
kill -TERM "$restore_copy_pid"
if ! wait_for_process_exit "$restore_copy_pid"; then
  force_stop_hang_probe "$restore_copy_pid" "$RESTORE_COPY_MARKER"
  fail 'restore TERM remained blocked during snapshot copy'
fi
set +e
wait "$restore_copy_pid"
restore_copy_status=$?
set -e
[[ "$restore_copy_status" == '143' ]] \
  || fail "restore-copy TERM status was $restore_copy_status, expected 143"
assert_no_owned_runtime 'com.smartqoldau.minio-restore-validation.run'
printf 'PASS: TERM during restore copy is bounded and owned-only\n'

readonly RESTORE_TIMEOUT_MARKER="$WORK_DIR/restore-timeout-hang.pid"
timeout_started=$SECONDS
if SMARTQOLDAU_HANG_MARKER="$RESTORE_TIMEOUT_MARKER" \
  PATH="$HANG_DOCKER_BIN:$PATH" \
  "$VALIDATE_SCRIPT" \
    --backup "$BACKUP_DIR" \
    --minio-image "$MINIO_IMAGE_ID" \
    --operation-timeout 1 \
    --expectations "$WORK_DIR/expectations.json" \
    >"$WORK_DIR/restore-timeout.log" 2>&1; then
  fail 'restore copy ignored its operation timeout'
fi
(( SECONDS - timeout_started < 8 )) \
  || fail 'restore copy operation timeout was not bounded'
[[ -s "$RESTORE_TIMEOUT_MARKER" ]] || fail 'restore timeout probe did not reach snapshot copy'
assert_no_owned_runtime 'com.smartqoldau.minio-restore-validation.run'
printf 'PASS: restore copy operation timeout is enforced\n'

if "$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9100 \
  --target-console-port 9101 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$BACKUP_DIR" \
  >"$WORK_DIR/overwrite.log" 2>&1; then
  fail 'backup overwrote an existing completed artifact'
fi
(cd -- "$BACKUP_DIR" && sha256sum --check SHA256SUMS) >/dev/null \
  || fail 'overwrite refusal changed the existing artifact'
printf 'PASS: backup refuses overwrite\n'

readonly RACE_BACKUP="$WORK_DIR/race-backup"
readonly RACE_BIN="$WORK_DIR/race-bin"
mkdir -m 700 -- "$RACE_BIN"
printf '%s\n' \
  '#!/bin/sh' \
  'previous=""' \
  'current=""' \
  'for argument do previous="$current"; current="$argument"; done' \
  'case "$previous" in' \
  '  */.race-backup.tmp.*)' \
  '    mkdir -m 700 -- "$current"' \
  '    printf "%s\n" preserved >"$current/existing-marker"' \
  '    ;;' \
  'esac' \
  'exec /usr/bin/mv "$@"' \
  >"$RACE_BIN/mv"
chmod 700 "$RACE_BIN/mv"
if PATH="$RACE_BIN:$PATH" "$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9600 \
  --target-console-port 9601 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$RACE_BACKUP" \
  >"$WORK_DIR/race.log" 2>&1; then
  fail 'backup accepted a destination created at publication time'
fi
[[ "$(cat "$RACE_BACKUP/existing-marker")" == 'preserved' ]] \
  || fail 'publication race changed the competing destination'
if find "$RACE_BACKUP" -mindepth 1 -maxdepth 1 ! -name existing-marker -print -quit | grep -q .; then
  fail 'publication race moved temporary content into the competing destination'
fi
if find "$WORK_DIR" -maxdepth 1 -name '.race-backup.tmp.*' -print -quit | grep -q .; then
  fail 'publication race left a temporary directory'
fi
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: publication-time race is rejected without mutation\n'

readonly CONCURRENT_BACKUP="$WORK_DIR/concurrent-backup"
"$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9400 \
  --target-console-port 9401 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$CONCURRENT_BACKUP" \
  >"$WORK_DIR/concurrent-one.log" 2>&1 &
concurrent_pid_one=$!
"$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9500 \
  --target-console-port 9501 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$CONCURRENT_BACKUP" \
  >"$WORK_DIR/concurrent-two.log" 2>&1 &
concurrent_pid_two=$!
set +e
wait "$concurrent_pid_one"
concurrent_status_one=$?
wait "$concurrent_pid_two"
concurrent_status_two=$?
set -e
if ! { [[ "$concurrent_status_one" == '0' && "$concurrent_status_two" != '0' ]] \
  || [[ "$concurrent_status_one" != '0' && "$concurrent_status_two" == '0' ]]; }; then
  fail "concurrent backup statuses were $concurrent_status_one/$concurrent_status_two, expected one success"
fi
(cd -- "$CONCURRENT_BACKUP" && sha256sum --check --strict SHA256SUMS) >/dev/null \
  || fail 'concurrent publication did not leave one valid backup'
if find "$WORK_DIR" -maxdepth 1 -name '.concurrent-backup.tmp.*' -print -quit | grep -q .; then
  fail 'concurrent backup publication left a temporary directory'
fi
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: concurrent publication is atomic and no-clobber\n'

readonly FAILED_BACKUP="$WORK_DIR/failed-backup"
if "$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint 'http://127.0.0.1:9999' \
  --target-port 9200 \
  --target-console-port 9201 \
  --minio-image "$MINIO_IMAGE_ID" \
  --output "$FAILED_BACKUP" \
  >"$WORK_DIR/failed.log" 2>&1; then
  fail 'backup reported success for an unreachable source endpoint'
fi
[[ ! -e "$FAILED_BACKUP" ]] || fail 'failed backup published a final artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.failed-backup.tmp.*' -print -quit | grep -q .; then
  fail 'failed backup left a temporary directory'
fi
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: failed backup leaves no artifact or runtime\n'

"$VALIDATE_SCRIPT" \
  --backup "$BACKUP_DIR" \
  --minio-image "$MINIO_IMAGE_ID" \
  --expectations "$WORK_DIR/expectations.json" \
  >"$WORK_DIR/restore.log" 2>&1 \
  || { sed -n '1,180p' "$WORK_DIR/restore.log" >&2; fail 'isolated restore validation failed'; }
for sensitive_value in \
  "$SOURCE_ACCESS" \
  "$SOURCE_SECRET" \
  'expert-documents' \
  'cases/2026/09/document.txt'; do
  if grep --fixed-strings --quiet "$sensitive_value" "$WORK_DIR/restore.log"; then
    fail 'restore log exposed credentials or object names'
  fi
done
assert_no_owned_runtime 'com.smartqoldau.minio-restore-validation.run'
printf 'PASS: isolated restore verifies nested, binary, content-type, and metadata invariants\n'

readonly REDACTED_EXPECTATIONS="$WORK_DIR/redacted-expectations.json"
readonly REDACTED_LOG="$WORK_DIR/redacted-expectation.log"
readonly SENSITIVE_BUCKET='expert-documents'
readonly SENSITIVE_KEY='cases/private/credential-like-secret.pdf'
jq --arg key "$SENSITIVE_KEY" '.objects = [(.objects[0] | .key = $key)]' \
  "$WORK_DIR/expectations.json" >"$REDACTED_EXPECTATIONS"
if "$VALIDATE_SCRIPT" \
  --backup "$BACKUP_DIR" \
  --minio-image "$MINIO_IMAGE_ID" \
  --expectations "$REDACTED_EXPECTATIONS" \
  >"$REDACTED_LOG" 2>&1; then
  fail 'restore validation accepted a missing sensitive expectation'
fi
for sensitive_value in "$SENSITIVE_BUCKET" "$SENSITIVE_KEY" "$SOURCE_SECRET"; do
  if grep --fixed-strings --quiet "$sensitive_value" "$REDACTED_LOG"; then
    fail 'restore validation failure disclosed a bucket, key, or credential'
  fi
done
grep --fixed-strings --quiet 'expectation #1' "$REDACTED_LOG" \
  || fail 'restore validation failure did not identify the stable expectation index'
assert_no_owned_runtime 'com.smartqoldau.minio-restore-validation.run'
printf 'PASS: failing expectations redact bucket, key, and credentials\n'

readonly CORRUPT_BACKUP="$WORK_DIR/corrupt-backup"
cp -a -- "$BACKUP_DIR" "$CORRUPT_BACKUP"
printf 'corruption' >>"$CORRUPT_BACKUP/minio-data.tar"
if "$VALIDATE_SCRIPT" \
  --backup "$CORRUPT_BACKUP" \
  --minio-image "$MINIO_IMAGE_ID" \
  --expectations "$WORK_DIR/expectations.json" \
  >"$WORK_DIR/corrupt.log" 2>&1; then
  fail 'restore validation accepted checksum corruption'
fi
assert_no_owned_runtime 'com.smartqoldau.minio-restore-validation.run'
printf 'PASS: checksum corruption is rejected before restore\n'

source_mc mb source/zz-slow >/dev/null
dd if=/dev/zero of="$WORK_DIR/slow.bin" bs=1024 count=256 status=none
source_mc pipe source/zz-slow/slow.bin <"$WORK_DIR/slow.bin" >/dev/null
readonly TIMED_OUT_BACKUP="$WORK_DIR/timed-out-backup"
timeout_started=$SECONDS
if "$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9800 \
  --target-console-port 9801 \
  --minio-image "$MINIO_IMAGE_ID" \
  --limit-download 1KiB \
  --operation-timeout 2 \
  --output "$TIMED_OUT_BACKUP" \
  >"$WORK_DIR/timed-out-backup.log" 2>&1; then
  fail 'slow logical mirror ignored its natural operation timeout'
fi
(( SECONDS - timeout_started < 15 )) \
  || fail 'natural mirror timeout cleanup was not bounded'
[[ "$(docker container inspect --format '{{.State.Running}}' "$source_container_id")" == 'true' ]] \
  || fail 'natural mirror timeout stopped the source MinIO container'
[[ ! -e "$TIMED_OUT_BACKUP" ]] || fail 'natural mirror timeout published an artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.timed-out-backup.tmp.*' -print -quit | grep -q .; then
  fail 'natural mirror timeout left a host temporary directory'
fi
for sensitive_value in "$SOURCE_SECRET" 'zz-slow' 'slow.bin'; do
  if grep --fixed-strings --quiet "$sensitive_value" "$WORK_DIR/timed-out-backup.log"; then
    fail 'natural mirror timeout log exposed credentials or object names'
  fi
done
assert_no_source_backup_state
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: natural mirror timeout removes owned source state and target\n'

readonly INTERRUPTED_BACKUP="$WORK_DIR/interrupted-backup"
"$BACKUP_SCRIPT" \
  --container "$source_container_id" \
  --endpoint "$SOURCE_ENDPOINT" \
  --target-port 9300 \
  --target-console-port 9301 \
  --minio-image "$MINIO_IMAGE_ID" \
  --limit-download 1KiB \
  --output "$INTERRUPTED_BACKUP" \
  >"$WORK_DIR/interrupted.log" 2>&1 &
backup_pid=$!
wait_until 'owned backup target startup' bash -c \
  "[[ -n \"\$(docker ps --quiet --filter label=com.smartqoldau.minio-backup.run)\" ]]"
kill -TERM "$backup_pid"
deadline=$((SECONDS + 15))
while kill -0 "$backup_pid" 2>/dev/null; do
  (( SECONDS < deadline )) || fail 'interrupted backup did not exit within 15 seconds'
  sleep 0.2
done
set +e
wait "$backup_pid"
signal_status=$?
set -e
[[ "$signal_status" == '143' ]] || fail "backup TERM status was $signal_status, expected 143"
[[ "$(docker container inspect --format '{{.State.Running}}' "$source_container_id")" == 'true' ]] \
  || fail 'backup interruption stopped the source MinIO container'
[[ ! -e "$INTERRUPTED_BACKUP" ]] || fail 'interrupted backup published a final artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.interrupted-backup.tmp.*' -print -quit | grep -q .; then
  fail 'interrupted backup left a temporary directory'
fi
assert_no_owned_runtime 'com.smartqoldau.minio-backup.run'
printf 'PASS: TERM cleanup is bounded to owned mirror and target\n'

printf 'PASS: MinIO backup and isolated restore validation\n'
