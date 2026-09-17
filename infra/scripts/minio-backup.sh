#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: minio-backup.sh \
  --container CONTAINER --endpoint URL \
  --target-port PORT --target-console-port PORT \
  --minio-image IMAGE --output BACKUP_DIRECTORY \
  [--limit-download RATE]

Create a logical, current-object MinIO backup from the explicitly selected
running container. The source stays online and its data volume is never read
directly. Objects are mirrored with `mc mirror --preserve` into an owned
temporary MinIO that shares only the source container's network namespace.
After the mirror finishes, that temporary MinIO is stopped and its cold /data
snapshot is published atomically with inventories and SHA-256 checksums.

This is not an atomic multi-object snapshot. Quiesce application writers
externally when a mutually consistent object set is required. Historical
versions, delete markers, bucket policies/locking, encrypted-object recovery,
IAM, KMS keys, lifecycle/replication configuration, and MinIO server
configuration are outside this backup's verified guarantees.
EOF
}

die() {
  printf 'minio-backup: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local remaining="$2"
  (( remaining >= 2 )) || die "$option requires a value"
}

container=''
endpoint=''
target_port=''
target_console_port=''
minio_image=''
output=''
limit_download=''

while (( $# > 0 )); do
  case "$1" in
    --container)
      require_value "$1" "$#"
      container="$2"
      shift 2
      ;;
    --endpoint)
      require_value "$1" "$#"
      endpoint="$2"
      shift 2
      ;;
    --target-port)
      require_value "$1" "$#"
      target_port="$2"
      shift 2
      ;;
    --target-console-port)
      require_value "$1" "$#"
      target_console_port="$2"
      shift 2
      ;;
    --minio-image)
      require_value "$1" "$#"
      minio_image="$2"
      shift 2
      ;;
    --output)
      require_value "$1" "$#"
      output="$2"
      shift 2
      ;;
    --limit-download)
      require_value "$1" "$#"
      limit_download="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$container" ]] || die '--container is required; no source is selected implicitly'
[[ -n "$endpoint" ]] || die '--endpoint is required'
[[ "$endpoint" =~ ^https?://[^/@[:space:]]+/?$ ]] \
  || die '--endpoint must be an http(s) URL without credentials or a path'
[[ -n "$target_port" ]] || die '--target-port is required'
[[ -n "$target_console_port" ]] || die '--target-console-port is required'
for candidate in "$target_port" "$target_console_port"; do
  [[ "$candidate" =~ ^[0-9]+$ ]] && (( candidate >= 1 && candidate <= 65535 )) \
    || die 'target ports must be between 1 and 65535'
done
[[ "$target_port" != "$target_console_port" ]] || die 'target ports must be different'
[[ -n "$minio_image" ]] || die '--minio-image is required; no image is selected implicitly'
[[ -n "$output" ]] || die '--output is required'
if [[ -n "$limit_download" ]]; then
  [[ "$limit_download" =~ ^[1-9][0-9]*(KiB|MiB|GiB)$ ]] \
    || die '--limit-download must be a positive KiB, MiB, or GiB rate'
fi

for command_name in docker grep jq sha256sum mktemp tar timeout; do
  command -v "$command_name" >/dev/null 2>&1 || die "$command_name is required"
done

if [[ -e "$output" || -L "$output" ]]; then
  die "refusing to overwrite existing backup: $output"
fi
output_parent="$(dirname -- "$output")"
output_name="$(basename -- "$output")"
[[ -d "$output_parent" ]] || die "output parent does not exist: $output_parent"
[[ "$output_name" != '.' && "$output_name" != '..' && -n "$output_name" ]] \
  || die 'invalid output directory name'

source_record="$(docker container inspect \
  --format '{{.Id}}|{{.State.Running}}' "$container" 2>/dev/null)" \
  || die "source container does not exist: $container"
source_id="${source_record%%|*}"
source_running="${source_record#*|}"
[[ "$source_running" == 'true' ]] || die "source container is not running: $container"
docker exec "$source_id" sh -ceu '
  [ -n "${MINIO_ROOT_USER:-}" ]
  [ -n "${MINIO_ROOT_PASSWORD:-}" ]
  command -v mc >/dev/null
' >/dev/null 2>&1 || die 'source must expose MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, and mc'

image_id="$(docker image inspect --format '{{.Id}}' "$minio_image" 2>/dev/null)" \
  || die "MinIO image is not available locally: $minio_image"
[[ "$image_id" =~ ^sha256:[[:xdigit:]]{64}$ ]] || die 'MinIO image has an unexpected image ID'

temporary_directory="$(mktemp -d "$output_parent/.${output_name}.tmp.XXXXXX")" \
  || die 'cannot create temporary backup directory'
chmod 700 "$temporary_directory"
published=0
target_container_id=''
active_child_pid=''
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
readonly TOKEN="${RUN_ID//[^a-zA-Z0-9_]/_}"
readonly TARGET_NAME="smartqoldau-minio-backup-$RUN_ID"
readonly TARGET_LABEL_KEY='com.smartqoldau.minio-backup.run'
readonly TARGET_LABEL="$TARGET_LABEL_KEY=$RUN_ID"
readonly CONTROL_DIRECTORY="/tmp/smartqoldau-minio-backup-$TOKEN"
target_access="sqbackup${TOKEN:0:16}"
target_secret="$(printf '%s' "$RUN_ID-$RANDOM-$(date +%s%N)" | sha256sum | awk '{print $1}')"
credential_env="$temporary_directory/.target.env"
credential_input="$temporary_directory/.target.credentials"
printf 'MINIO_ROOT_USER=%s\nMINIO_ROOT_PASSWORD=%s\n' \
  "$target_access" "$target_secret" >"$credential_env"
printf '%s\n%s\n' "$target_access" "$target_secret" >"$credential_input"
chmod 600 "$credential_env" "$credential_input"

target_is_owned() {
  local ownership
  [[ -n "$target_container_id" ]] || return 1
  ownership="$(docker container inspect \
    --format '{{.Id}}|{{ index .Config.Labels "com.smartqoldau.minio-backup.run" }}' \
    "$target_container_id" 2>/dev/null)" || return 1
  [[ "$ownership" == "$target_container_id|$RUN_ID" ]]
}

remove_owned_target() {
  [[ -n "$target_container_id" ]] || return 0
  if ! docker container inspect "$target_container_id" >/dev/null 2>&1; then
    target_container_id=''
    return 0
  fi
  if ! target_is_owned; then
    printf 'minio-backup: refusing target cleanup without exact ID and run-label ownership\n' >&2
    return 1
  fi
  docker rm --force "$target_container_id" >/dev/null || return 1
  if docker container inspect "$target_container_id" >/dev/null 2>&1; then
    printf 'minio-backup: target container cleanup could not be confirmed\n' >&2
    return 1
  fi
  target_container_id=''
}

stop_owned_target() {
  target_is_owned || return 1
  docker stop --time 5 "$target_container_id" >/dev/null
  [[ "$(docker container inspect --format '{{.State.Running}}' "$target_container_id")" == 'false' ]]
}

terminate_owned_mirror() {
  timeout --signal=KILL 5 docker exec "$source_id" sh -ceu '
    token="$1"
    control_directory="/tmp/smartqoldau-minio-backup-$token"
    case "$token" in ""|*[!a-zA-Z0-9_]*) exit 64 ;; esac

    has_token() {
      process_id="$1"
      [ -r "/proc/$process_id/environ" ] || return 1
      token_environment="$(tr "\0" "\n" <"/proc/$process_id/environ" 2>/dev/null)" \
        || return 1
      newline="$(printf "\nX")"
      newline="${newline%X}"
      case "${newline}${token_environment}${newline}" in
        *"${newline}SMARTQOLDAU_MINIO_BACKUP_TOKEN=$token${newline}"*) return 0 ;;
        *) return 1 ;;
      esac
    }

    token_pids=""
    for environment in /proc/[0-9]*/environ; do
      process_id="${environment#/proc/}"
      process_id="${process_id%/environ}"
      if has_token "$process_id"; then
        token_pids="$token_pids $process_id"
      fi
    done
    for process_id in $token_pids; do
      kill -TERM "$process_id" 2>/dev/null || true
    done
    attempts=0
    while [ "$attempts" -lt 30 ]; do
      found=0
      for environment in /proc/[0-9]*/environ; do
        process_id="${environment#/proc/}"
        process_id="${process_id%/environ}"
        has_token "$process_id" && found=1
      done
      [ "$found" -eq 0 ] && break
      attempts=$((attempts + 1))
      sleep 0.1
    done
    if [ "$found" -ne 0 ]; then
      for environment in /proc/[0-9]*/environ; do
        process_id="${environment#/proc/}"
        process_id="${process_id%/environ}"
        has_token "$process_id" && kill -KILL "$process_id" 2>/dev/null || true
      done
      sleep 0.1
    fi
    for environment in /proc/[0-9]*/environ; do
      process_id="${environment#/proc/}"
      process_id="${process_id%/environ}"
      has_token "$process_id" && exit 70
    done
    rm -rf -- "$control_directory"
  ' sh "$TOKEN"
}

verify_owned_mirror_cleanup() {
  timeout --signal=KILL 3 docker exec "$source_id" sh -ceu '
    token="$1"
    control_directory="/tmp/smartqoldau-minio-backup-$token"
    [ ! -e "$control_directory" ] || exit 71
    for environment in /proc/[0-9]*/environ; do
      token_environment=""
      if token_environment="$(tr "\0" "\n" <"$environment" 2>/dev/null)" \
        ; then
        newline="$(printf "\nX")"
        newline="${newline%X}"
        case "${newline}${token_environment}${newline}" in
          *"${newline}SMARTQOLDAU_MINIO_BACKUP_TOKEN=$token${newline}"*) exit 72 ;;
        esac
      fi
    done
  ' sh "$TOKEN"
}

cleanup() {
  local status=$?
  if [[ -n "$active_child_pid" ]] && kill -0 "$active_child_pid" 2>/dev/null; then
    terminate_owned_mirror >/dev/null 2>&1 || status=1
    kill -TERM "$active_child_pid" 2>/dev/null || true
    wait "$active_child_pid" 2>/dev/null || true
    active_child_pid=''
  fi
  if ! remove_owned_target; then
    status=1
  fi
  if (( published == 0 )) && [[ -d "$temporary_directory" ]]; then
    rm -rf -- "$temporary_directory"
  fi
  exit "$status"
}

handle_signal() {
  local signal_status="$1"
  local cleanup_ok=1
  trap '' HUP INT TERM
  if ! terminate_owned_mirror; then
    cleanup_ok=0
  fi
  if [[ -n "$active_child_pid" ]]; then
    kill -TERM "$active_child_pid" 2>/dev/null || true
    wait "$active_child_pid" 2>/dev/null || true
    active_child_pid=''
  fi
  if ! verify_owned_mirror_cleanup; then
    cleanup_ok=0
  fi
  if ! remove_owned_target; then
    cleanup_ok=0
  fi
  (( cleanup_ok == 1 )) || signal_status=1
  exit "$signal_status"
}

trap cleanup EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

target_container_id="$(docker create \
  --name "$TARGET_NAME" \
  --label "$TARGET_LABEL" \
  --network "container:$source_id" \
  --env-file "$credential_env" \
  "$minio_image" server /data \
    --address ":$target_port" \
    --console-address ":$target_console_port")" \
  || die 'could not create owned backup target MinIO'
target_is_owned || die 'created backup target does not have expected ownership'
docker start "$target_container_id" >/dev/null || die 'could not start owned backup target MinIO'

run_logical_mirror() {
  docker exec --interactive \
    --env "SMARTQOLDAU_MINIO_BACKUP_TOKEN=$TOKEN" \
    "$source_id" sh -ceu '
      endpoint="$1"
      target_port="$2"
      limit_download="$3"
      token="${SMARTQOLDAU_MINIO_BACKUP_TOKEN:-}"
      case "$token" in ""|*[!a-zA-Z0-9_]*) exit 64 ;; esac
      control_directory="/tmp/smartqoldau-minio-backup-$token"
      umask 077
      mkdir -m 700 -- "$control_directory"
      config_directory="$control_directory/mc"
      mkdir -m 700 -- "$config_directory"
      mirror_pid=""
      cleanup_control() {
        rm -rf -- "$control_directory"
      }
      forward_signal() {
        signal_status="$1"
        if [ -n "$mirror_pid" ]; then
          kill -TERM "$mirror_pid" 2>/dev/null || true
          wait "$mirror_pid" 2>/dev/null || true
        fi
        exit "$signal_status"
      }
      trap cleanup_control EXIT
      trap "forward_signal 129" HUP
      trap "forward_signal 130" INT
      trap "forward_signal 143" TERM

      IFS= read -r target_access
      IFS= read -r target_secret
      [ -n "$target_access" ] && [ -n "$target_secret" ]
      printf "%s\n%s\n" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
        | MC_CONFIG_DIR="$config_directory" mc alias set source "$endpoint" \
          --api S3v4 --path auto --quiet >/dev/null
      printf "%s\n%s\n" "$target_access" "$target_secret" \
        | MC_CONFIG_DIR="$config_directory" mc alias set target \
          "http://127.0.0.1:$target_port" --api S3v4 --path auto --quiet >/dev/null

      ready=0
      attempt=0
      while [ "$attempt" -lt 30 ]; do
        if MC_CONFIG_DIR="$config_directory" mc ready target >/dev/null 2>&1; then
          ready=1
          break
        fi
        attempt=$((attempt + 1))
        sleep 0.2
      done
      [ "$ready" -eq 1 ] || exit 69

      if [ -n "$limit_download" ]; then
        MC_CONFIG_DIR="$config_directory" mc mirror --preserve --quiet \
          --limit-download "$limit_download" source target >/dev/null 2>&1 &
      else
        MC_CONFIG_DIR="$config_directory" mc mirror --preserve --quiet \
          source target >/dev/null 2>&1 &
      fi
      mirror_pid="$!"
      printf "%s\n%s\n" "$$" "$mirror_pid" >"$control_directory/pids"
      chmod 600 "$control_directory/pids"
      wait "$mirror_pid"
    ' sh "$endpoint" "$target_port" "$limit_download" <"$credential_input"
}

run_logical_mirror &
active_child_pid=$!
set +e
wait "$active_child_pid"
mirror_status=$?
set -e
active_child_pid=''
(( mirror_status == 0 )) || die 'logical object mirror failed; no final backup was published'
verify_owned_mirror_cleanup || die 'owned source-side mirror cleanup could not be confirmed'

target_mc() {
  docker exec --interactive "$source_id" sh -ceu '
    target_port="$1"
    shift
    config_directory="$(mktemp -d /tmp/smartqoldau-minio-inventory.XXXXXX)"
    trap "rm -rf -- \"$config_directory\"" EXIT
    IFS= read -r target_access
    IFS= read -r target_secret
    printf "%s\n%s\n" "$target_access" "$target_secret" \
      | MC_CONFIG_DIR="$config_directory" mc alias set target \
        "http://127.0.0.1:$target_port" --api S3v4 --path auto --quiet >/dev/null
    MC_CONFIG_DIR="$config_directory" mc "$@"
  ' sh "$target_port" "$@" <"$credential_input"
}

target_mc ls --json target \
  | jq -cS 'if .status == "success" then {name, type} else error(.error.message // "mc ls failed") end' \
  >"$temporary_directory/BUCKETS.jsonl" \
  || die 'could not inventory mirrored buckets'
target_mc stat --recursive --json target \
  | jq -cS 'if .status == "success" then {checksum, etag, lastModified, metadata, name, size, type} else error(.error.message // "mc stat failed") end' \
  >"$temporary_directory/OBJECTS.jsonl" \
  || die 'could not inventory mirrored objects'

jq -nS \
  --arg format 'smartqoldau-minio-backup-v1' \
  --arg created_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg image_id "$image_id" \
  --arg consistency 'current objects copied independently; no multi-object or database point-in-time guarantee' \
  --arg exclusions 'historical versions, delete markers, bucket policies/locking, encrypted-object recovery, IAM, KMS keys, lifecycle/replication configuration, server configuration' \
  '{format: $format, createdAt: $created_at, minioImageId: $image_id, consistency: $consistency, exclusions: $exclusions}' \
  >"$temporary_directory/manifest.json"
chmod 600 "$temporary_directory/BUCKETS.jsonl" \
  "$temporary_directory/OBJECTS.jsonl" "$temporary_directory/manifest.json"

stop_owned_target || die 'could not prove owned backup target was quiesced'
docker cp "$target_container_id:/data/." - >"$temporary_directory/minio-data.tar" \
  || die 'could not stream cold target data snapshot'
chmod 600 "$temporary_directory/minio-data.tar"
tar --list --file "$temporary_directory/minio-data.tar" >/dev/null \
  || die 'cold target data snapshot is not a readable tar archive'
if grep --binary-files=text --fixed-strings --quiet --file="$credential_input" \
  "$temporary_directory/BUCKETS.jsonl" \
  "$temporary_directory/OBJECTS.jsonl" \
  "$temporary_directory/manifest.json" \
  "$temporary_directory/minio-data.tar"; then
  die 'temporary target credentials appeared in backup content'
fi
remove_owned_target || die 'could not confirm owned backup target cleanup'
rm -f -- "$credential_env" "$credential_input"
target_access=''
target_secret=''

(
  cd -- "$temporary_directory"
  sha256sum BUCKETS.jsonl OBJECTS.jsonl manifest.json minio-data.tar >SHA256SUMS
  chmod 600 SHA256SUMS
  sha256sum --check --strict SHA256SUMS >/dev/null
) || die 'backup checksum verification failed'

mv --no-target-directory --no-clobber "$temporary_directory" "$output"
if [[ -d "$temporary_directory" ]]; then
  die "output appeared during backup; refusing to overwrite: $output"
fi
published=1
printf 'MinIO backup created: %s\n' "$output"
