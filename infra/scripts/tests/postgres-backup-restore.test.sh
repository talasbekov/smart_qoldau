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

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local container_owner volume_owner

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

  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 60); do
    if docker exec "$SOURCE_CONTAINER_ID" pg_isready --quiet --username fixture_user --dbname fixture_db; then
      return 0
    fi
    sleep 1
  done
  fail 'fixture PostgreSQL did not become ready'
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

"$BACKUP_SCRIPT" \
  --container "$SOURCE_CONTAINER_ID" \
  --host 127.0.0.1 \
  --port 5432 \
  --database fixture_db \
  --user fixture_user \
  --password-file "$PASSWORD_FILE" \
  --output "$BACKUP_DIR" \
  >"$WORK_DIR/backup.log" 2>&1

[[ -f "$BACKUP_DIR/database.dump" ]] || fail 'backup dump was not created'
[[ -f "$BACKUP_DIR/SHA256SUMS" ]] || fail 'backup checksum was not created'
(cd -- "$BACKUP_DIR" && sha256sum --check SHA256SUMS) >/dev/null || fail 'backup checksum does not verify'
[[ "$(head -c 5 "$BACKUP_DIR/database.dump")" == 'PGDMP' ]] || fail 'backup is not PostgreSQL custom format'
if grep --fixed-strings --quiet "$PASSWORD" "$WORK_DIR/backup.log"; then
  fail 'backup log exposed the database password'
fi

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

"$VALIDATE_SCRIPT" \
  --backup "$BACKUP_DIR" \
  --check-sql "$CHECK_SQL" \
  >"$WORK_DIR/restore-success.log" 2>&1
readonly BACKUP_SHA="$(cut -d ' ' -f 1 "$BACKUP_DIR/SHA256SUMS")"
assert_no_validation_container "$BACKUP_SHA"

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
