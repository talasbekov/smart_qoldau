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

cleanup() {
  local status=$?
  local owner=''
  trap - EXIT HUP INT TERM

  if [[ -n "$container_id" ]] && docker container inspect "$container_id" >/dev/null 2>&1; then
    owner="$(docker container inspect --format "{{ index .Config.Labels \"com.smartqoldau.restore-validation.run\" }}" "$container_id" 2>/dev/null || true)"
    if [[ "$owner" != "$RUN_ID" ]]; then
      printf 'postgres-restore-validate: refusing to remove a container not owned by this run\n' >&2
      status=1
    elif ! docker container rm --force "$container_id" >/dev/null; then
      printf 'postgres-restore-validate: failed to remove validation container %s\n' "$container_id" >&2
      status=1
    fi
  fi

  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

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

ready=0
for _attempt in $(seq 1 60); do
  if docker exec "$container_id" pg_isready --quiet --username restore_validator --dbname restore_validation; then
    ready=1
    break
  fi
  sleep 1
done
(( ready == 1 )) || die 'isolated PostgreSQL did not become ready'

server_version_num="$(
  docker exec "$container_id" \
    psql --no-psqlrc --tuples-only --no-align \
      --username restore_validator --dbname restore_validation \
      --command 'SHOW server_version_num'
)" || die 'could not determine validation PostgreSQL version'
[[ "$server_version_num" =~ ^16[0-9]{4}$ ]] \
  || die "validation requires PostgreSQL 16, got server_version_num=$server_version_num"

docker exec --interactive "$container_id" \
  pg_restore \
    --exit-on-error \
    --single-transaction \
    --no-owner \
    --no-privileges \
    --username restore_validator \
    --dbname restore_validation \
  <"$backup_directory/database.dump" \
  || die 'pg_restore failed in the isolated validation database'

docker exec --interactive "$container_id" \
  psql \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --username restore_validator \
    --dbname restore_validation \
  <"$check_sql" \
  || die 'restored data invariant check failed'

printf 'PostgreSQL restore validation succeeded for %s\n' "$backup_directory"
