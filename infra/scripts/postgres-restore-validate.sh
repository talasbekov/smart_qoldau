#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: postgres-restore-validate.sh --backup BACKUP_DIRECTORY --check-sql FILE

Verify BACKUP_DIRECTORY/database.dump against its SHA256SUMS, restore it into
a newly created isolated PostgreSQL 16 container, and execute FILE with
ON_ERROR_STOP enabled. The validation container has no network and stores its
database on tmpfs. It is removed on success, failure, or interruption.

This command never connects to or overwrites an existing database. It is not a
production restore command.
EOF
}

die() {
  printf 'postgres-restore-validate: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local remaining="$2"
  (( remaining >= 2 )) || die "$option requires a value"
}

backup_directory=''
check_sql=''

while (( $# > 0 )); do
  case "$1" in
    --backup)
      require_value "$1" "$#"
      backup_directory="$2"
      shift 2
      ;;
    --check-sql)
      require_value "$1" "$#"
      check_sql="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[[ -n "$backup_directory" ]] || die '--backup is required'
[[ -n "$check_sql" ]] || die '--check-sql is required; validation must assert restored data invariants'
[[ -d "$backup_directory" && ! -L "$backup_directory" ]] || die 'backup must be a directory, not a symlink'
[[ -f "$backup_directory/database.dump" && ! -L "$backup_directory/database.dump" ]] \
  || die 'backup does not contain a regular database.dump'
[[ -f "$backup_directory/SHA256SUMS" && ! -L "$backup_directory/SHA256SUMS" ]] \
  || die 'backup does not contain a regular SHA256SUMS'
[[ -f "$check_sql" && ! -L "$check_sql" && -s "$check_sql" ]] \
  || die 'check SQL must be a non-empty regular file, not a symlink'

command -v docker >/dev/null 2>&1 || die 'docker is required'
command -v sha256sum >/dev/null 2>&1 || die 'sha256sum is required'
command -v mktemp >/dev/null 2>&1 || die 'mktemp is required'
command -v timeout >/dev/null 2>&1 || die 'timeout is required'

mapfile -t checksum_lines <"$backup_directory/SHA256SUMS"
(( ${#checksum_lines[@]} == 1 )) || die 'SHA256SUMS must contain exactly one entry'
[[ "${checksum_lines[0]}" =~ ^([[:xdigit:]]{64})\ \ database\.dump$ ]] \
  || die 'SHA256SUMS must contain only the checksum for database.dump'
expected_sha="${BASH_REMATCH[1],,}"
actual_sha="$(sha256sum "$backup_directory/database.dump")"
actual_sha="${actual_sha%% *}"
[[ "$actual_sha" == "$expected_sha" ]] || die 'database.dump checksum mismatch'
[[ "$(head -c 5 "$backup_directory/database.dump")" == 'PGDMP' ]] \
  || die 'database.dump is not PostgreSQL custom format'

readonly POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
readonly CONTAINER_NAME="smartqoldau-restore-validation-$RUN_ID"
container_id=''
active_child_pid=''
readiness_output="$(mktemp "${TMPDIR:-/tmp}/smartqoldau-restore-readiness.XXXXXX")" \
  || die 'cannot create readiness output file'

docker_control() {
  timeout --signal=KILL 3 docker "$@"
}

container_ownership_state() {
  local details listed actual_id owner candidate

  if details="$(
    docker_control container inspect \
      --format '{{.Id}}|{{ index .Config.Labels "com.smartqoldau.restore-validation.run" }}' \
      "$container_id" 2>/dev/null
  )"; then
    actual_id="${details%%|*}"
    owner="${details#*|}"
    [[ "$actual_id" == "$container_id" && "$owner" == "$RUN_ID" ]] || return 5
    return 0
  fi

  if ! listed="$(
    docker_control container ls --all --no-trunc --quiet --filter "id=$container_id" 2>/dev/null
  )"; then
    return 4
  fi
  while IFS= read -r candidate; do
    [[ "$candidate" == "$container_id" ]] && return 4
  done <<<"$listed"
  return 3
}

remove_validation_container() {
  local state
  [[ -n "$container_id" ]] || return 0

  if container_ownership_state; then
    state=0
  else
    state=$?
  fi

  if (( state == 0 )); then
    if ! docker_control container rm --force "$container_id" >/dev/null; then
      printf 'postgres-restore-validate: failed to remove validation container %s\n' "$container_id" >&2
      return 1
    fi
    container_id=''
    return 0
  fi

  case "$state" in
    3)
      container_id=''
      return 0
      ;;
    5)
      printf 'postgres-restore-validate: refusing to remove a container without exact ID and run-label ownership\n' >&2
      ;;
    *)
      printf 'postgres-restore-validate: could not confirm validation container cleanup because Docker inspection failed\n' >&2
      ;;
  esac
  return 1
}

wait_for_child_exit() {
  local process_id="$1"
  local deadline=$((SECONDS + 5))
  while kill -0 "$process_id" 2>/dev/null; do
    (( SECONDS < deadline )) || return 1
    sleep 0.1
  done
  return 0
}

run_managed() {
  local status
  "$@" &
  active_child_pid=$!
  set +e
  wait "$active_child_pid"
  status=$?
  set -e
  active_child_pid=''
  return "$status"
}

run_managed_with_input() {
  local input_file="$1"
  local status
  shift
  "$@" <"$input_file" &
  active_child_pid=$!
  set +e
  wait "$active_child_pid"
  status=$?
  set -e
  active_child_pid=''
  return "$status"
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM

  if ! remove_validation_container; then
    status=1
  fi
  rm -f -- "$readiness_output"

  exit "$status"
}

handle_signal() {
  local signal_status="$1"
  trap '' HUP INT TERM

  if ! remove_validation_container; then
    signal_status=1
  fi
  if [[ -n "$active_child_pid" ]] && kill -0 "$active_child_pid" 2>/dev/null; then
    if ! wait_for_child_exit "$active_child_pid"; then
      kill -TERM "$active_child_pid" 2>/dev/null || true
      sleep 0.2
      kill -KILL "$active_child_pid" 2>/dev/null || true
    fi
    wait "$active_child_pid" 2>/dev/null || true
    active_child_pid=''
  fi
  exit "$signal_status"
}
trap cleanup EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

container_id="$(
  docker run --detach \
    --name "$CONTAINER_NAME" \
    --label "com.smartqoldau.restore-validation.run=$RUN_ID" \
    --label "com.smartqoldau.restore-validation.backup-sha=$expected_sha" \
    --network none \
    --tmpfs /var/lib/postgresql/data:rw,nosuid,noexec \
    --env POSTGRES_HOST_AUTH_METHOD=trust \
    --env POSTGRES_USER=restore_validator \
    --env POSTGRES_DB=restore_validation \
    "$POSTGRES_IMAGE"
)" || die 'could not start isolated PostgreSQL validation container'

server_version_num=''
for _attempt in $(seq 1 60); do
  : >"$readiness_output"
  if run_managed docker exec "$container_id" \
    psql --no-psqlrc --tuples-only --no-align \
      --host 127.0.0.1 --port 5432 \
      --username restore_validator --dbname restore_validation \
      --command 'SHOW server_version_num' \
    >"$readiness_output" 2>/dev/null; then
    server_version_num="$(tr -d '[:space:]' <"$readiness_output")"
    if [[ "$server_version_num" =~ ^16[0-9]{4}$ ]]; then
      break
    fi
  fi
  sleep 1
done
[[ "$server_version_num" =~ ^16[0-9]{4}$ ]] \
  || die 'isolated PostgreSQL 16 database did not become query-ready'

run_managed_with_input "$backup_directory/database.dump" \
  docker exec --interactive "$container_id" \
  pg_restore \
    --exit-on-error \
    --single-transaction \
    --no-owner \
    --no-privileges \
    --username restore_validator \
    --dbname restore_validation \
  || die 'pg_restore failed in the isolated validation database'

run_managed_with_input "$check_sql" \
  docker exec --interactive "$container_id" \
  psql \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --username restore_validator \
    --dbname restore_validation \
  || die 'restored data invariant check failed'

remove_validation_container \
  || die 'restore completed but validation container cleanup could not be confirmed'
printf 'PostgreSQL restore validation succeeded for %s\n' "$backup_directory"
