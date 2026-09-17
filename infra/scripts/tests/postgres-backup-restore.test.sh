#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPTS_DIR="$(cd -- "$TEST_DIR/.." && pwd -P)"
readonly BACKUP_SCRIPT="$SCRIPTS_DIR/postgres-backup.sh"
readonly VALIDATE_SCRIPT="$SCRIPTS_DIR/postgres-restore-validate.sh"
readonly POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
readonly RUN_ID="e30-$RANDOM-$$"
readonly OWNER_LABEL="com.smartqoldau.backup-test.run=$RUN_ID"
readonly SOURCE_CONTAINER="smartqoldau-backup-source-$RUN_ID"
readonly SOURCE_VOLUME="smartqoldau-backup-source-$RUN_ID"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-backup-test.XXXXXX")"
readonly PASSWORD='fixture:password\with-specials'
readonly PASSWORD_FILE="$WORK_DIR/postgres-password"
readonly BACKUP_DIR="$WORK_DIR/verified-backup"

SOURCE_CONTAINER_ID=''
LOCK_EXEC_PID=''
BACKUP_PROCESS_PID=''
VALIDATION_PROCESS_PID=''
VALIDATION_CONTAINER_ID=''
CONCURRENT_PID_ONE=''
CONCURRENT_PID_TWO=''

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local container_owner validation_sha volume_owner

  for process_id in "$BACKUP_PROCESS_PID" "$VALIDATION_PROCESS_PID" "$LOCK_EXEC_PID" "$CONCURRENT_PID_ONE" "$CONCURRENT_PID_TWO"; do
    if [[ -n "$process_id" ]] && kill -0 "$process_id" 2>/dev/null; then
      kill -TERM "$process_id" 2>/dev/null || true
    fi
  done

  if [[ -n "$VALIDATION_CONTAINER_ID" ]] && docker container inspect "$VALIDATION_CONTAINER_ID" >/dev/null 2>&1; then
    validation_sha="$(docker container inspect --format "{{ index .Config.Labels \"com.smartqoldau.restore-validation.backup-sha\" }}" "$VALIDATION_CONTAINER_ID")"
    if [[ -n "${BACKUP_SHA:-}" && "$validation_sha" == "$BACKUP_SHA" ]]; then
      docker container rm --force "$VALIDATION_CONTAINER_ID" >/dev/null
    fi
  fi

  if [[ -n "$SOURCE_CONTAINER_ID" ]] && docker container inspect "$SOURCE_CONTAINER_ID" >/dev/null 2>&1; then
    container_owner="$(docker container inspect --format "{{ index .Config.Labels \"com.smartqoldau.backup-test.run\" }}" "$SOURCE_CONTAINER_ID")"
    if [[ "$container_owner" == "$RUN_ID" ]]; then
      docker container rm --force "$SOURCE_CONTAINER_ID" >/dev/null
    fi
  fi

  if docker volume inspect "$SOURCE_VOLUME" >/dev/null 2>&1; then
    volume_owner="$(docker volume inspect --format "{{ index .Labels \"com.smartqoldau.backup-test.run\" }}" "$SOURCE_VOLUME")"
    if [[ "$volume_owner" == "$RUN_ID" ]]; then
      docker volume rm "$SOURCE_VOLUME" >/dev/null
    fi
  fi

  for process_id in "$BACKUP_PROCESS_PID" "$VALIDATION_PROCESS_PID" "$LOCK_EXEC_PID" "$CONCURRENT_PID_ONE" "$CONCURRENT_PID_TWO"; do
    if [[ -n "$process_id" ]]; then
      wait "$process_id" 2>/dev/null || true
    fi
  done

  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 60); do
    if docker exec "$SOURCE_CONTAINER_ID" \
      psql --no-psqlrc --quiet --tuples-only --no-align \
        --host 127.0.0.1 --port 5432 \
        --username fixture_user --dbname fixture_db --command 'SELECT 1' \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail 'fixture PostgreSQL did not become ready'
}

wait_for_query_count() {
  local container_id="$1"
  local query="$2"
  local attempt count
  for attempt in $(seq 1 100); do
    count="$(
      docker exec "$container_id" \
        psql --no-psqlrc --quiet --tuples-only --no-align \
          --username fixture_user --dbname fixture_db --command "$query" \
        2>/dev/null || true
    )"
    if [[ "$count" =~ ^[1-9][0-9]*$ ]]; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

wait_for_process_exit() {
  local process_id="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))
  while kill -0 "$process_id" 2>/dev/null; do
    (( SECONDS < deadline )) || return 1
    sleep 0.1
  done
  return 0
}

assert_no_validation_container() {
  local backup_sha="$1"
  local found
  found="$(docker ps --all --quiet --filter "label=com.smartqoldau.restore-validation.backup-sha=$backup_sha")"
  [[ -z "$found" ]] || fail "restore validator leaked container(s): $found"
}

[[ -x "$BACKUP_SCRIPT" ]] || fail "$BACKUP_SCRIPT is not executable"
[[ -x "$VALIDATE_SCRIPT" ]] || fail "$VALIDATE_SCRIPT is not executable"

if "$BACKUP_SCRIPT" >"$WORK_DIR/invalid-backup.log" 2>&1; then
  fail 'backup accepted missing explicit source arguments'
fi
if "$VALIDATE_SCRIPT" >"$WORK_DIR/invalid-restore.log" 2>&1; then
  fail 'restore validation accepted missing backup and SQL check'
fi

umask 077
printf '%s\n' "$PASSWORD" >"$PASSWORD_FILE"

docker volume create --label "$OWNER_LABEL" "$SOURCE_VOLUME" >/dev/null
SOURCE_CONTAINER_ID="$(
  docker run --detach \
    --name "$SOURCE_CONTAINER" \
    --label "$OWNER_LABEL" \
    --network none \
    --volume "$SOURCE_VOLUME:/var/lib/postgresql/data" \
    --env POSTGRES_USER=fixture_user \
    --env POSTGRES_PASSWORD="$PASSWORD" \
    --env POSTGRES_DB=fixture_db \
    "$POSTGRES_IMAGE"
)"
wait_for_postgres

docker exec --interactive "$SOURCE_CONTAINER_ID" \
  psql --no-psqlrc --set ON_ERROR_STOP=1 --username fixture_user --dbname fixture_db <<'SQL'
CREATE TABLE backup_parent (
  id integer PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE backup_child (
  id integer PRIMARY KEY,
  parent_id integer NOT NULL REFERENCES backup_parent(id),
  label text NOT NULL
);
INSERT INTO backup_parent (id, name) VALUES
  (1, 'alpha'),
  (2, 'beta');
INSERT INTO backup_child (id, parent_id, label) VALUES
  (10, 1, 'first'),
  (11, 1, 'second'),
  (12, 2, 'third');
SQL

if ! "$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database fixture_db \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$BACKUP_DIR" \
  >"$WORK_DIR/backup.log" 2>&1; then
  sed -n '1,120p' "$WORK_DIR/backup.log" >&2
  fail 'initial backup failed'
fi

[[ -f "$BACKUP_DIR/database.dump" ]] || fail 'backup dump was not created'
[[ -f "$BACKUP_DIR/SHA256SUMS" ]] || fail 'backup checksum was not created'
(cd -- "$BACKUP_DIR" && sha256sum --check SHA256SUMS) >/dev/null || fail 'backup checksum does not verify'
[[ "$(head -c 5 "$BACKUP_DIR/database.dump")" == 'PGDMP' ]] || fail 'backup is not PostgreSQL custom format'
if grep --fixed-strings --quiet "$PASSWORD" "$WORK_DIR/backup.log"; then
  fail 'backup log exposed the database password'
fi
printf 'PASS: custom backup artifact\n'

readonly ORIGINAL_SHA="$(sha256sum "$BACKUP_DIR/database.dump")"
if "$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database fixture_db \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$BACKUP_DIR" \
  >"$WORK_DIR/overwrite.log" 2>&1; then
  fail 'backup overwrote an existing completed backup'
fi
[[ "$(sha256sum "$BACKUP_DIR/database.dump")" == "$ORIGINAL_SHA" ]] || fail 'existing backup changed after overwrite attempt'

readonly FAILED_BACKUP="$WORK_DIR/failed-backup"
if "$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database missing_database \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$FAILED_BACKUP" \
  >"$WORK_DIR/dump-failure.log" 2>&1; then
  fail 'backup reported success when pg_dump failed'
fi
[[ ! -e "$FAILED_BACKUP" ]] || fail 'failed dump left a final backup artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.failed-backup.tmp.*' -print -quit | grep -q .; then
  fail 'failed dump left a temporary backup directory'
fi
printf 'PASS: no-clobber and failed-dump cleanup\n'

readonly CONCURRENT_BACKUP="$WORK_DIR/concurrent-backup"
"$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" --host 127.0.0.1 --port 5432 \
  --database fixture_db --user fixture_user --password-file "$PASSWORD_FILE" \
  --output "$CONCURRENT_BACKUP" >"$WORK_DIR/concurrent-one.log" 2>&1 &
CONCURRENT_PID_ONE=$!
"$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" --host 127.0.0.1 --port 5432 \
  --database fixture_db --user fixture_user --password-file "$PASSWORD_FILE" \
  --output "$CONCURRENT_BACKUP" >"$WORK_DIR/concurrent-two.log" 2>&1 &
CONCURRENT_PID_TWO=$!
set +e
wait "$CONCURRENT_PID_ONE"
concurrent_status_one=$?
wait "$CONCURRENT_PID_TWO"
concurrent_status_two=$?
set -e
CONCURRENT_PID_ONE=''
CONCURRENT_PID_TWO=''
if ! { [[ "$concurrent_status_one" == '0' && "$concurrent_status_two" != '0' ]] \
  || [[ "$concurrent_status_one" != '0' && "$concurrent_status_two" == '0' ]]; }; then
  fail "concurrent publication statuses were $concurrent_status_one/$concurrent_status_two, expected one success"
fi
(cd -- "$CONCURRENT_BACKUP" && sha256sum --check --strict SHA256SUMS) >/dev/null \
  || fail 'concurrent publication did not leave one valid backup'
if find "$WORK_DIR" -maxdepth 1 -name '.concurrent-backup.tmp.*' -print -quit | grep -q .; then
  fail 'concurrent publication left a temporary directory'
fi
if grep --fixed-strings --quiet "$PASSWORD" "$WORK_DIR/concurrent-one.log" "$WORK_DIR/concurrent-two.log"; then
  fail 'concurrent backup logs exposed the database password'
fi
printf 'PASS: atomic concurrent no-clobber publication\n'

readonly CHECK_SQL="$WORK_DIR/check.sql"
cat >"$CHECK_SQL" <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM backup_parent) <> 2 THEN
    RAISE EXCEPTION 'unexpected parent row count';
  END IF;
  IF (SELECT count(*) FROM backup_child) <> 3 THEN
    RAISE EXCEPTION 'unexpected child row count';
  END IF;
  IF (SELECT count(*)
      FROM backup_child child
      JOIN backup_parent parent ON parent.id = child.parent_id
      WHERE parent.name = 'alpha') <> 2 THEN
    RAISE EXCEPTION 'restored parent/child relationship is invalid';
  END IF;
END
$$;
SQL

if ! "$VALIDATE_SCRIPT" \
  --backup "$BACKUP_DIR" \
  --check-sql "$CHECK_SQL" \
  >"$WORK_DIR/restore-success.log" 2>&1; then
  sed -n '1,160p' "$WORK_DIR/restore-success.log" >&2
  fail 'initial isolated restore validation failed'
fi
readonly BACKUP_SHA="$(cut -d ' ' -f 1 "$BACKUP_DIR/SHA256SUMS")"
assert_no_validation_container "$BACKUP_SHA"
printf 'PASS: isolated restore and invariant check\n'

readonly LOCK_APPLICATION_NAME="smartqoldau_test_lock_${RUN_ID//-/_}"
docker exec --env "PGAPPNAME=$LOCK_APPLICATION_NAME" "$SOURCE_CONTAINER_ID" \
  psql --no-psqlrc --set ON_ERROR_STOP=1 --username fixture_user --dbname fixture_db \
    --command 'BEGIN; LOCK TABLE backup_parent IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(30);' \
  >"$WORK_DIR/lock.log" 2>&1 &
LOCK_EXEC_PID=$!
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$LOCK_APPLICATION_NAME' AND wait_event = 'PgSleep'" \
  || fail 'test lock query did not become active'

readonly INTERRUPTED_BACKUP="$WORK_DIR/interrupted-backup"
"$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database fixture_db \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$INTERRUPTED_BACKUP" \
  >"$WORK_DIR/interrupted-backup.log" 2>&1 &
BACKUP_PROCESS_PID=$!
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'pg_dump' OR application_name LIKE 'smartqoldau_backup_%'" \
  || fail 'blocked pg_dump did not become visible'
host_backup_argv="$(tr '\0' ' ' <"/proc/$BACKUP_PROCESS_PID/cmdline")"
if grep --fixed-strings --quiet "$PASSWORD" <<<"$host_backup_argv"; then
  fail 'host backup argv exposed the database password'
fi
container_process_argv="$(docker exec "$SOURCE_CONTAINER_ID" sh -ceu '
  for command_line in /proc/[0-9]*/cmdline; do
    tr "\0" " " <"$command_line" 2>/dev/null || true
    printf "\n"
  done
')"
if grep --fixed-strings --quiet "$PASSWORD" <<<"$container_process_argv"; then
  fail 'container process argv exposed the database password'
fi

kill -TERM "$BACKUP_PROCESS_PID"
wait_for_process_exit "$BACKUP_PROCESS_PID" 10 \
  || fail 'backup did not exit within 10 seconds after TERM'
set +e
wait "$BACKUP_PROCESS_PID"
backup_signal_status=$?
set -e
BACKUP_PROCESS_PID=''
[[ "$backup_signal_status" == '143' ]] || fail "backup TERM status was $backup_signal_status, expected 143"
[[ "$(docker container inspect --format '{{.State.Running}}' "$SOURCE_CONTAINER_ID")" == 'true' ]] \
  || fail 'backup cancellation stopped the source container'
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$LOCK_APPLICATION_NAME' AND wait_event = 'PgSleep'" \
  || fail 'backup cancellation stopped an unrelated source query'
[[ ! -e "$INTERRUPTED_BACKUP" ]] || fail 'interrupted backup published a final artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.interrupted-backup.tmp.*' -print -quit | grep -q .; then
  fail 'interrupted backup left a temporary directory'
fi
if grep --fixed-strings --quiet "$PASSWORD" "$WORK_DIR/interrupted-backup.log"; then
  fail 'interrupted backup log exposed the database password'
fi
pgpass_leftovers="$(
  docker exec "$SOURCE_CONTAINER_ID" \
    find /tmp -maxdepth 1 \( -name 'smartqoldau-pgpass.*' -o -name 'smartqoldau-cancel-pgpass.*' \) -print
)"
[[ -z "$pgpass_leftovers" ]] || fail "interrupted backup left password files: $pgpass_leftovers"
owned_dump_count="$(
  docker exec "$SOURCE_CONTAINER_ID" \
    psql --no-psqlrc --quiet --tuples-only --no-align \
      --username fixture_user --dbname fixture_db \
      --command "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'smartqoldau_backup_%'"
)"
[[ "$owned_dump_count" == '0' ]] || fail 'interrupted backup left its PostgreSQL backend running'
docker exec "$SOURCE_CONTAINER_ID" \
  psql --no-psqlrc --quiet --tuples-only --no-align \
    --username fixture_user --dbname fixture_db \
    --command "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = '$LOCK_APPLICATION_NAME'" \
  >/dev/null
wait "$LOCK_EXEC_PID" 2>/dev/null || true
LOCK_EXEC_PID=''
printf 'PASS: bounded backup TERM preserves unrelated source query\n'

readonly PSQL_PATH="$(docker exec "$SOURCE_CONTAINER_ID" sh -ceu 'command -v psql')"
docker exec --interactive "$SOURCE_CONTAINER_ID" sh -s -- "$PSQL_PATH" <<'SH'
set -eu
psql_path="$1"
mv -- "$psql_path" "${psql_path}.smartqoldau-real"
cat >"$psql_path" <<'WRAPPER'
#!/bin/sh
for argument in "$@"; do
  case "$argument" in
    *pg_cancel_backend*)
      printf 'refused\n' >>/tmp/smartqoldau-test-cancel-refused
      exit 77
      ;;
  esac
done
exec "${0}.smartqoldau-real" "$@"
WRAPPER
chmod 755 "$psql_path"
SH

readonly REFUSAL_LOCK_APPLICATION_NAME="smartqoldau_test_refusal_lock_${RUN_ID//-/_}"
docker exec --env "PGAPPNAME=$REFUSAL_LOCK_APPLICATION_NAME" "$SOURCE_CONTAINER_ID" \
  psql --no-psqlrc --set ON_ERROR_STOP=1 --username fixture_user --dbname fixture_db \
    --command 'BEGIN; LOCK TABLE backup_parent IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(30);' \
  >"$WORK_DIR/refusal-lock.log" 2>&1 &
LOCK_EXEC_PID=$!
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$REFUSAL_LOCK_APPLICATION_NAME' AND wait_event = 'PgSleep'" \
  || fail 'cancel-refusal lock query did not become active'

readonly REFUSAL_BACKUP="$WORK_DIR/cancel-refusal-backup"
"$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database fixture_db \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$REFUSAL_BACKUP" \
  >"$WORK_DIR/cancel-refusal.log" 2>&1 &
BACKUP_PROCESS_PID=$!
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'smartqoldau_backup_%'" \
  || fail 'cancel-refusal pg_dump did not become visible'

kill -TERM "$BACKUP_PROCESS_PID"
wait_for_process_exit "$BACKUP_PROCESS_PID" 10 \
  || fail 'backup with refused SQL cancel did not exit within 10 seconds after TERM'
set +e
wait "$BACKUP_PROCESS_PID"
refusal_signal_status=$?
set -e
BACKUP_PROCESS_PID=''
if [[ "$refusal_signal_status" != '143' ]]; then
  sed -n '1,160p' "$WORK_DIR/cancel-refusal.log" >&2
  fail "cancel-refusal backup TERM status was $refusal_signal_status, expected 143"
fi
docker exec "$SOURCE_CONTAINER_ID" test -s /tmp/smartqoldau-test-cancel-refused \
  || fail 'cancel-refusal fixture did not exercise the failed secondary psql path'
docker exec "$SOURCE_CONTAINER_ID" rm -f -- /tmp/smartqoldau-test-cancel-refused
[[ "$(docker container inspect --format '{{.State.Running}}' "$SOURCE_CONTAINER_ID")" == 'true' ]] \
  || fail 'cancel-refusal fallback stopped the source container'
wait_for_query_count "$SOURCE_CONTAINER_ID" \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$REFUSAL_LOCK_APPLICATION_NAME' AND wait_event = 'PgSleep'" \
  || fail 'cancel-refusal fallback stopped an unrelated source query'

refusal_owned_backend_count="$(
  docker exec "$SOURCE_CONTAINER_ID" \
    psql --no-psqlrc --quiet --tuples-only --no-align \
      --username fixture_user --dbname fixture_db \
      --command "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'smartqoldau_backup_%'"
)"
[[ "$refusal_owned_backend_count" == '0' ]] \
  || fail 'cancel-refusal fallback left its PostgreSQL backend running'
refusal_owned_clients="$(docker exec "$SOURCE_CONTAINER_ID" sh -ceu '
  for environment in /proc/[0-9]*/environ; do
    token_environment=""
    if token_environment="$(tr "\0" "\n" 2>/dev/null <"$environment")" \
      && printf "%s\n" "$token_environment" | grep -q "^SMARTQOLDAU_BACKUP_TOKEN="; then
      printf "%s\n" "$environment"
    fi
  done
')"
[[ -z "$refusal_owned_clients" ]] \
  || fail "cancel-refusal fallback left owned client processes: $refusal_owned_clients"
refusal_control_leftovers="$(
  docker exec "$SOURCE_CONTAINER_ID" \
    find /tmp -maxdepth 2 \
      \( -name 'smartqoldau-pgpass.*' -o -name 'smartqoldau-cancel-pgpass.*' -o -name 'smartqoldau-backup-*' \) \
      -print
)"
[[ -z "$refusal_control_leftovers" ]] \
  || fail "cancel-refusal fallback left credential/control files: $refusal_control_leftovers"
[[ ! -e "$REFUSAL_BACKUP" ]] || fail 'cancel-refusal backup published a final artifact'
if find "$WORK_DIR" -maxdepth 1 -name '.cancel-refusal-backup.tmp.*' -print -quit | grep -q .; then
  fail 'cancel-refusal backup left a temporary directory'
fi

docker exec "$SOURCE_CONTAINER_ID" "${PSQL_PATH}.smartqoldau-real" \
  --no-psqlrc --quiet --tuples-only --no-align \
  --username fixture_user --dbname fixture_db \
  --command "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = '$REFUSAL_LOCK_APPLICATION_NAME'" \
  >/dev/null
wait "$LOCK_EXEC_PID" 2>/dev/null || true
LOCK_EXEC_PID=''
docker exec "$SOURCE_CONTAINER_ID" sh -ceu '
  psql_path="$1"
  rm -f -- "$psql_path"
  mv -- "${psql_path}.smartqoldau-real" "$psql_path"
' sh "$PSQL_PATH"
printf 'PASS: exact-process fallback after refused SQL cancel\n'

readonly LONG_CHECK_SQL="$WORK_DIR/long-check.sql"
printf 'SELECT pg_sleep(30);\n' >"$LONG_CHECK_SQL"
"$VALIDATE_SCRIPT" --backup "$BACKUP_DIR" --check-sql "$LONG_CHECK_SQL" \
  >"$WORK_DIR/interrupted-validation.log" 2>&1 &
VALIDATION_PROCESS_PID=$!
for _attempt in $(seq 1 100); do
  VALIDATION_CONTAINER_ID="$(
    docker ps --quiet --filter "label=com.smartqoldau.restore-validation.backup-sha=$BACKUP_SHA" | head -n 1
  )"
  [[ -n "$VALIDATION_CONTAINER_ID" ]] && break
  sleep 0.1
done
[[ -n "$VALIDATION_CONTAINER_ID" ]] || fail 'validation container did not start'
for _attempt in $(seq 1 100); do
  long_query_count="$(
    docker exec "$VALIDATION_CONTAINER_ID" \
      psql --no-psqlrc --quiet --tuples-only --no-align \
        --username restore_validator --dbname restore_validation \
        --command "SELECT count(*) FROM pg_stat_activity WHERE query = 'SELECT pg_sleep(30);' AND state = 'active'" \
      2>/dev/null || true
  )"
  [[ "$long_query_count" =~ ^[1-9][0-9]*$ ]] && break
  sleep 0.1
done
[[ "$long_query_count" =~ ^[1-9][0-9]*$ ]] || fail 'long validation SQL did not become active'

kill -TERM "$VALIDATION_PROCESS_PID"
wait_for_process_exit "$VALIDATION_PROCESS_PID" 10 \
  || fail 'restore validation did not exit within 10 seconds after TERM'
set +e
wait "$VALIDATION_PROCESS_PID"
validation_signal_status=$?
set -e
VALIDATION_PROCESS_PID=''
[[ "$validation_signal_status" == '143' ]] \
  || fail "restore validation TERM status was $validation_signal_status, expected 143"
assert_no_validation_container "$BACKUP_SHA"
VALIDATION_CONTAINER_ID=''
printf 'PASS: bounded restore-validation TERM cleanup\n'

readonly FAILING_CHECK_SQL="$WORK_DIR/failing-check.sql"
cat >"$FAILING_CHECK_SQL" <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM backup_child) = 3 THEN
    RAISE EXCEPTION 'intentional invariant failure';
  END IF;
END
$$;
SQL
if "$VALIDATE_SCRIPT" --backup "$BACKUP_DIR" --check-sql "$FAILING_CHECK_SQL" >"$WORK_DIR/check-failure.log" 2>&1; then
  fail 'restore validation ignored a failing restored-data invariant'
fi
assert_no_validation_container "$BACKUP_SHA"

readonly CORRUPT_BACKUP="$WORK_DIR/corrupt-backup"
cp -a -- "$BACKUP_DIR" "$CORRUPT_BACKUP"
printf 'damage' >>"$CORRUPT_BACKUP/database.dump"
if "$VALIDATE_SCRIPT" --backup "$CORRUPT_BACKUP" --check-sql "$CHECK_SQL" >"$WORK_DIR/corrupt.log" 2>&1; then
  fail 'restore validation accepted a dump with a bad checksum'
fi
assert_no_validation_container "$BACKUP_SHA"

readonly TRUNCATED_BACKUP="$WORK_DIR/truncated-backup"
cp -a -- "$BACKUP_DIR" "$TRUNCATED_BACKUP"
readonly ORIGINAL_SIZE="$(stat --format '%s' "$TRUNCATED_BACKUP/database.dump")"
truncate --size "$((ORIGINAL_SIZE / 2))" "$TRUNCATED_BACKUP/database.dump"
(cd -- "$TRUNCATED_BACKUP" && sha256sum database.dump >SHA256SUMS)
readonly TRUNCATED_SHA="$(cut -d ' ' -f 1 "$TRUNCATED_BACKUP/SHA256SUMS")"
if "$VALIDATE_SCRIPT" --backup "$TRUNCATED_BACKUP" --check-sql "$CHECK_SQL" >"$WORK_DIR/truncated.log" 2>&1; then
  fail 'restore validation accepted a truncated dump with a matching checksum'
fi
assert_no_validation_container "$TRUNCATED_SHA"

printf 'PASS: PostgreSQL backup and isolated restore validation\n'
