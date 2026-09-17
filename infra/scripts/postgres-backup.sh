#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: postgres-backup.sh \
  --container CONTAINER --host HOST --port PORT \
  --database DATABASE --user USER --password-file FILE \
  --output BACKUP_DIRECTORY

Create one PostgreSQL custom-format backup from an explicitly selected running
container. BACKUP_DIRECTORY must not exist. The completed directory contains
database.dump and SHA256SUMS and is published only after both files verify.

The password file must contain exactly one non-empty line and must not be
accessible by group or other users. Its value is sent over stdin to a temporary
PGPASSFILE inside the selected container; it is never placed in command-line
arguments or logs.
EOF
}

die() {
  printf 'postgres-backup: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local remaining="$2"
  (( remaining >= 2 )) || die "$option requires a value"
}

container=''
host=''
port=''
database=''
database_user=''
password_file=''
output=''

while (( $# > 0 )); do
  case "$1" in
    --container)
      require_value "$1" "$#"
      container="$2"
      shift 2
      ;;
    --host)
      require_value "$1" "$#"
      host="$2"
      shift 2
      ;;
    --port)
      require_value "$1" "$#"
      port="$2"
      shift 2
      ;;
    --database)
      require_value "$1" "$#"
      database="$2"
      shift 2
      ;;
    --user)
      require_value "$1" "$#"
      database_user="$2"
      shift 2
      ;;
    --password-file)
      require_value "$1" "$#"
      password_file="$2"
      shift 2
      ;;
    --output)
      require_value "$1" "$#"
      output="$2"
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

[[ -n "$container" ]] || die '--container is required; no source is selected implicitly'
[[ -n "$host" ]] || die '--host is required'
[[ -n "$port" ]] || die '--port is required'
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 )) || die '--port must be between 1 and 65535'
[[ -n "$database" ]] || die '--database is required'
[[ -n "$database_user" ]] || die '--user is required'
[[ -n "$password_file" ]] || die '--password-file is required'
[[ -n "$output" ]] || die '--output is required'

command -v docker >/dev/null 2>&1 || die 'docker is required'
command -v sha256sum >/dev/null 2>&1 || die 'sha256sum is required'
command -v mktemp >/dev/null 2>&1 || die 'mktemp is required'
command -v timeout >/dev/null 2>&1 || die 'timeout is required'

[[ -f "$password_file" && ! -L "$password_file" ]] || die 'password file must be a regular file, not a symlink'
[[ -r "$password_file" ]] || die 'password file is not readable'
awk 'NR > 1 { exit 1 } END { if (NR != 1 || length($0) == 0) exit 1 }' "$password_file" \
  || die 'password file must contain exactly one non-empty line'

password_mode="$(stat --format '%a' "$password_file")" || die 'cannot inspect password file permissions'
(( (8#$password_mode & 077) == 0 )) || die 'password file must not be accessible by group or other users'

if [[ -e "$output" || -L "$output" ]]; then
  die "refusing to overwrite existing backup: $output"
fi

output_parent="$(dirname -- "$output")"
output_name="$(basename -- "$output")"
[[ -d "$output_parent" ]] || die "output parent does not exist: $output_parent"
[[ "$output_name" != '.' && "$output_name" != '..' && -n "$output_name" ]] || die 'invalid output directory name'

container_running="$(docker container inspect --format '{{.State.Running}}' "$container" 2>/dev/null)" \
  || die "source container does not exist: $container"
[[ "$container_running" == 'true' ]] || die "source container is not running: $container"

temporary_directory="$(mktemp -d "$output_parent/.${output_name}.tmp.XXXXXX")" \
  || die 'cannot create temporary backup directory'
published=0
active_child_pid=''
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
readonly BACKUP_TOKEN="${RUN_ID//[^a-zA-Z0-9_]/_}"
readonly BACKUP_APPLICATION_NAME="smartqoldau_backup_$BACKUP_TOKEN"

wait_for_child_exit() {
  local process_id="$1"
  local deadline=$((SECONDS + 5))
  while kill -0 "$process_id" 2>/dev/null; do
    (( SECONDS < deadline )) || return 1
    sleep 0.1
  done
  return 0
}

run_control_sql() {
  local control_application_name="$1"
  local sql="$2"
  timeout --signal=KILL 3 docker exec --interactive "$container" sh -ceu '
    escape_pgpass() {
      printf "%s" "$1" | sed -e "s/\\\\/\\\\\\\\/g" -e "s/:/\\\\:/g"
    }

    umask 077
    pgpass_file="$(mktemp /tmp/smartqoldau-cancel-pgpass.XXXXXX)"
    cleanup_pgpass() {
      rm -f -- "$pgpass_file"
    }
    trap cleanup_pgpass EXIT
    trap "exit 129" HUP
    trap "exit 130" INT
    trap "exit 143" TERM

    IFS= read -r password
    [ -n "$password" ] || exit 65
    printf "%s:%s:%s:%s:%s\n" \
      "$(escape_pgpass "$1")" \
      "$(escape_pgpass "$2")" \
      "$(escape_pgpass "$3")" \
      "$(escape_pgpass "$4")" \
      "$(escape_pgpass "$password")" \
      >"$pgpass_file"

    PGAPPNAME="$5" PGPASSFILE="$pgpass_file" psql \
      --no-psqlrc \
      --quiet \
      --tuples-only \
      --no-align \
      --no-password \
      --host="$1" \
      --port="$2" \
      --dbname="$3" \
      --username="$4" \
      --command="$6"
  ' sh "$host" "$port" "$database" "$database_user" "$control_application_name" "$sql" \
    <"$password_file"
}

cancel_backup_backend() {
  local cancel_result cancel_sql
  cancel_sql="
    WITH target AS MATERIALIZED (
      SELECT pid
      FROM pg_stat_activity
      WHERE application_name = '$BACKUP_APPLICATION_NAME'
        AND datname = current_database()
        AND usename = current_user
    ), cardinality AS (
      SELECT count(*) AS target_count, min(pid) AS target_pid
      FROM target
    ), attempt AS (
      SELECT
        target_count,
        CASE
          WHEN target_count = 1 THEN pg_cancel_backend(target_pid)
          ELSE false
        END AS cancelled
      FROM cardinality
    )
    SELECT CASE
      WHEN target_count = 1 AND cancelled THEN 'SMARTQOLDAU_CANCELLED'
      ELSE 'SMARTQOLDAU_CANCEL_NOT_CONFIRMED'
    END
    FROM attempt"

  if ! cancel_result="$(run_control_sql "smartqoldau_cancel_$BACKUP_TOKEN" "$cancel_sql")"; then
    return 1
  fi
  [[ "$cancel_result" == 'SMARTQOLDAU_CANCELLED' ]]
}

terminate_owned_client() {
  timeout --signal=KILL 4 docker exec "$container" sh -ceu '
    token="$1"
    expected_application="$2"
    control_directory="/tmp/smartqoldau-backup-$token"
    pid_file="$control_directory/pids"

    case "$token" in
      ""|*[!a-zA-Z0-9_]*) exit 64 ;;
    esac

    has_token() {
      process_id="$1"
      token_environment=""
      [ -r "/proc/$process_id/environ" ] || return 1
      token_environment="$(tr "\0" "\n" 2>/dev/null <"/proc/$process_id/environ")" \
        || return 1
      printf "%s\n" "$token_environment" \
        | grep -Fqx "SMARTQOLDAU_BACKUP_TOKEN=$token"
    }

    token_process_exists() {
      for environment in /proc/[0-9]*/environ; do
        process_id="${environment#/proc/}"
        process_id="${process_id%/environ}"
        has_token "$process_id" && return 0
      done
      return 1
    }

    if [ ! -e "$control_directory" ]; then
      token_process_exists && exit 70
      exit 0
    fi

    [ -f "$pid_file" ] || exit 71
    {
      IFS= read -r wrapper_pid
      IFS= read -r dump_pid
      IFS= read -r recorded_application
    } <"$pid_file"
    case "$wrapper_pid:$dump_pid" in
      *[!0-9:]*|:*|*:) exit 72 ;;
    esac
    [ "$recorded_application" = "$expected_application" ] || exit 73
    has_token "$wrapper_pid" || exit 74
    has_token "$dump_pid" || exit 75
    [ "$(cat "/proc/$dump_pid/comm" 2>/dev/null)" = pg_dump ] || exit 76
    parent_pid="$(grep "^PPid:" "/proc/$dump_pid/status" 2>/dev/null | tr -cd "0-9")"
    [ "$parent_pid" = "$wrapper_pid" ] || exit 77

    kill -TERM "$dump_pid"
    attempts=0
    while kill -0 "$dump_pid" 2>/dev/null && [ "$attempts" -lt 20 ]; do
      attempts=$((attempts + 1))
      sleep 0.1
    done
    if kill -0 "$dump_pid" 2>/dev/null; then
      has_token "$dump_pid" || exit 78
      kill -KILL "$dump_pid"
    fi

    attempts=0
    while has_token "$wrapper_pid" && [ "$attempts" -lt 10 ]; do
      attempts=$((attempts + 1))
      sleep 0.1
    done
    if has_token "$wrapper_pid"; then
      kill -TERM "$wrapper_pid"
      attempts=0
      while has_token "$wrapper_pid" && [ "$attempts" -lt 10 ]; do
        attempts=$((attempts + 1))
        sleep 0.1
      done
    fi
    if has_token "$wrapper_pid"; then
      kill -KILL "$wrapper_pid"
      sleep 0.1
    fi
    token_process_exists && exit 79

    if [ -e "$control_directory" ]; then
      rm -f -- "$control_directory/pgpass" "$pid_file"
      rmdir -- "$control_directory" 2>/dev/null || exit 80
    fi
  ' sh "$BACKUP_TOKEN" "$BACKUP_APPLICATION_NAME"
}

verify_owned_cleanup() {
  local backend_count verify_sql

  if ! timeout --signal=KILL 3 docker exec "$container" sh -ceu '
    token="$1"
    control_directory="/tmp/smartqoldau-backup-$token"
    [ ! -e "$control_directory" ] || exit 81
    for environment in /proc/[0-9]*/environ; do
      token_environment=""
      if token_environment="$(tr "\0" "\n" 2>/dev/null <"$environment")" \
        && printf "%s\n" "$token_environment" \
          | grep -Fqx "SMARTQOLDAU_BACKUP_TOKEN=$token"; then
        exit 82
      fi
    done
  ' sh "$BACKUP_TOKEN"; then
    printf 'postgres-backup: owned client/control-file verification failed\n' >&2
    return 1
  fi

  verify_sql="SELECT count(*) FROM pg_stat_activity WHERE application_name = '$BACKUP_APPLICATION_NAME' AND datname = current_database() AND usename = current_user"
  if ! backend_count="$(run_control_sql "smartqoldau_verify_$BACKUP_TOKEN" "$verify_sql" 2>/dev/null)"; then
    printf 'postgres-backup: owned backend verification query failed\n' >&2
    return 1
  fi
  backend_count="$(tr -d '[:space:]' <<<"$backend_count")"
  if [[ "$backend_count" != '0' ]]; then
    printf 'postgres-backup: owned backend is still present\n' >&2
    return 1
  fi
  return 0
}

cleanup() {
  local status=$?
  if (( published == 0 )) && [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf -- "$temporary_directory"
  fi
  exit "$status"
}

handle_signal() {
  local signal_status="$1"
  local cleanup_confirmed=1
  trap '' HUP INT TERM

  if [[ -n "$active_child_pid" ]] && kill -0 "$active_child_pid" 2>/dev/null; then
    if ! cancel_backup_backend; then
      cleanup_confirmed=0
      if terminate_owned_client; then
        cleanup_confirmed=1
      fi
    fi
    if ! wait_for_child_exit "$active_child_pid"; then
      kill -TERM "$active_child_pid" 2>/dev/null || true
      sleep 0.2
      kill -KILL "$active_child_pid" 2>/dev/null || true
    fi
    wait "$active_child_pid" 2>/dev/null || true
    active_child_pid=''
  fi
  if verify_owned_cleanup; then
    cleanup_confirmed=1
  else
    cleanup_confirmed=0
  fi
  if (( cleanup_confirmed == 0 )); then
    printf 'postgres-backup: owned cleanup not confirmed; run=%s application=%s\n' \
      "$RUN_ID" "$BACKUP_APPLICATION_NAME" >&2
    signal_status=1
  fi
  exit "$signal_status"
}
trap cleanup EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

chmod 700 "$temporary_directory"
dump_file="$temporary_directory/database.dump"

docker exec --interactive \
  --env "SMARTQOLDAU_BACKUP_TOKEN=$BACKUP_TOKEN" \
  "$container" sh -ceu '
  escape_pgpass() {
    printf "%s" "$1" | sed -e "s/\\\\/\\\\\\\\/g" -e "s/:/\\\\:/g"
  }

  token="${SMARTQOLDAU_BACKUP_TOKEN:-}"
  case "$token" in
    ""|*[!a-zA-Z0-9_]*) exit 64 ;;
  esac
  control_directory="/tmp/smartqoldau-backup-$token"

  umask 077
  mkdir -m 700 -- "$control_directory"
  pgpass_file="$control_directory/pgpass"
  pid_file="$control_directory/pids"
  pid_file_temporary="$control_directory/pids.$$"
  dump_pid=""
  cleanup_pgpass() {
    rm -f -- "$pgpass_file" "$pid_file" "$pid_file_temporary"
    rmdir -- "$control_directory" 2>/dev/null || true
  }
  forward_signal() {
    signal_status="$1"
    if [ -n "$dump_pid" ]; then
      kill -TERM "$dump_pid" 2>/dev/null || true
      wait "$dump_pid" 2>/dev/null || true
    fi
    exit "$signal_status"
  }
  trap cleanup_pgpass EXIT
  trap "forward_signal 129" HUP
  trap "forward_signal 130" INT
  trap "forward_signal 143" TERM

  IFS= read -r password
  [ -n "$password" ] || exit 65
  printf "%s:%s:%s:%s:%s\n" \
    "$(escape_pgpass "$1")" \
    "$(escape_pgpass "$2")" \
    "$(escape_pgpass "$3")" \
    "$(escape_pgpass "$4")" \
    "$(escape_pgpass "$password")" \
    >"$pgpass_file"

  PGAPPNAME="$5" PGPASSFILE="$pgpass_file" pg_dump \
    --format=custom \
    --serializable-deferrable \
    --no-password \
    --host="$1" \
    --port="$2" \
    --dbname="$3" \
    --username="$4" &
  dump_pid="$!"
  printf "%s\n%s\n%s\n" "$$" "$dump_pid" "$5" >"$pid_file_temporary"
  chmod 600 "$pid_file_temporary"
  mv -- "$pid_file_temporary" "$pid_file"

  if wait "$dump_pid"; then
    dump_status=0
  else
    dump_status="$?"
  fi
  exit "$dump_status"
' sh "$host" "$port" "$database" "$database_user" "$BACKUP_APPLICATION_NAME" \
  <"$password_file" >"$dump_file" &
active_child_pid=$!
set +e
wait "$active_child_pid"
dump_status=$?
set -e
active_child_pid=''
if (( dump_status != 0 )); then
  die 'pg_dump failed; no final backup was published'
fi

chmod 600 "$dump_file"
[[ "$(head -c 5 "$dump_file")" == 'PGDMP' ]] || die 'pg_dump output is not PostgreSQL custom format'
docker exec --interactive "$container" pg_restore --list <"$dump_file" >/dev/null \
  || die 'pg_restore could not read the completed dump'

(
  cd -- "$temporary_directory"
  sha256sum database.dump >SHA256SUMS
  chmod 600 SHA256SUMS
  sha256sum --check --strict SHA256SUMS >/dev/null
) || die 'backup checksum verification failed'

mv --no-target-directory --no-clobber "$temporary_directory" "$output"
if [[ -d "$temporary_directory" ]]; then
  die "output appeared during backup; refusing to overwrite: $output"
fi
published=1

printf 'PostgreSQL backup created: %s\n' "$output"
