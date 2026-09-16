#!/usr/bin/env bash

set -Eeuo pipefail

readonly TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly VALIDATE_SCRIPT="$(cd -- "$TEST_DIR/.." && pwd -P)/postgres-restore-validate.sh"
readonly WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-restore-control.XXXXXX")"
readonly FAKE_BIN="$WORK_DIR/bin"
readonly BACKUP_DIR="$WORK_DIR/backup"
readonly CHECK_SQL="$WORK_DIR/check.sql"

cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

mkdir -p "$FAKE_BIN" "$BACKUP_DIR"
printf 'PGDMPsynthetic-control-fixture\n' >"$BACKUP_DIR/database.dump"
(cd -- "$BACKUP_DIR" && sha256sum database.dump >SHA256SUMS)
printf 'SELECT 1;\n' >"$CHECK_SQL"

cat >"$FAKE_BIN/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -u

state_dir="${FAKE_DOCKER_STATE_DIR:?}"
mode="${FAKE_DOCKER_MODE:?}"
mkdir -p "$state_dir"

contains_argument() {
  local needle="$1" argument
  shift
  for argument in "$@"; do
    [[ "$argument" == *"$needle"* ]] && return 0
  done
  return 1
}

case "${1:-}" in
  run)
    for argument in "$@"; do
      if [[ "$argument" == com.smartqoldau.restore-validation.run=* ]]; then
        printf '%s' "${argument#*=}" >"$state_dir/run-id"
      fi
    done
    printf 'fake-container-id\n'
    ;;
  exec)
    shift
    if contains_argument pg_isready "$@"; then
      exit 0
    fi
    if contains_argument pg_restore "$@"; then
      cat >/dev/null
      exit 0
    fi
    if contains_argument psql "$@" && contains_argument server_version_num "$@"; then
      attempts=0
      [[ ! -f "$state_dir/readiness-attempts" ]] || attempts="$(cat "$state_dir/readiness-attempts")"
      attempts=$((attempts + 1))
      printf '%s' "$attempts" >"$state_dir/readiness-attempts"
      if [[ "$mode" == readiness-retry && "$attempts" -lt 3 ]]; then
        printf 'database is still initializing\n' >&2
        exit 1
      fi
      printf '160000\n'
      exit 0
    fi
    if contains_argument psql "$@"; then
      cat >/dev/null
      exit 0
    fi
    ;;
  container)
    case "${2:-}" in
      inspect)
        if [[ "$mode" == cleanup-error || "$mode" == cleanup-absent ]]; then
          printf 'daemon unavailable\n' >&2
          exit 1
        fi
        run_id="$(cat "$state_dir/run-id")"
        if contains_argument '.Id' "$@"; then
          printf 'fake-container-id|%s\n' "$run_id"
        elif contains_argument 'Config.Labels' "$@"; then
          printf '%s\n' "$run_id"
        fi
        ;;
      ls)
        if [[ "$mode" == cleanup-error ]]; then
          printf 'daemon unavailable\n' >&2
          exit 1
        fi
        [[ "$mode" == cleanup-absent ]] && exit 0
        [[ -f "$state_dir/removed" ]] || printf 'fake-container-id\n'
        ;;
      rm)
        printf 'called\n' >>"$state_dir/rm-calls"
        : >"$state_dir/removed"
        ;;
    esac
    ;;
  ps)
    if [[ "$mode" == cleanup-error ]]; then
      printf 'daemon unavailable\n' >&2
      exit 1
    fi
    [[ -f "$state_dir/removed" ]] || printf 'fake-container-id\n'
    ;;
  *)
    printf 'unexpected fake docker call: %s\n' "$*" >&2
    exit 70
    ;;
esac
FAKE_DOCKER
chmod 755 "$FAKE_BIN/docker"

readiness_state="$WORK_DIR/readiness-state"
mkdir -p "$readiness_state"
if ! PATH="$FAKE_BIN:$PATH" \
  FAKE_DOCKER_STATE_DIR="$readiness_state" \
  FAKE_DOCKER_MODE=readiness-retry \
  "$VALIDATE_SCRIPT" --backup "$BACKUP_DIR" --check-sql "$CHECK_SQL" \
  >"$WORK_DIR/readiness.out" 2>"$WORK_DIR/readiness.err"; then
  fail 'validator did not retry the real database/version query during initialization'
fi
[[ "$(cat "$readiness_state/readiness-attempts")" == '3' ]] \
  || fail 'validator did not wait for the third successful database query'

absent_state="$WORK_DIR/absent-state"
mkdir -p "$absent_state"
if ! PATH="$FAKE_BIN:$PATH" \
  FAKE_DOCKER_STATE_DIR="$absent_state" \
  FAKE_DOCKER_MODE=cleanup-absent \
  "$VALIDATE_SCRIPT" --backup "$BACKUP_DIR" --check-sql "$CHECK_SQL" \
  >"$WORK_DIR/absent.out" 2>"$WORK_DIR/absent.err"; then
  fail 'validator did not distinguish an already-absent container from Docker inspection failure'
fi
[[ ! -e "$absent_state/rm-calls" ]] \
  || fail 'validator tried to remove a container already confirmed absent'

cleanup_state="$WORK_DIR/cleanup-state"
mkdir -p "$cleanup_state"
if PATH="$FAKE_BIN:$PATH" \
  FAKE_DOCKER_STATE_DIR="$cleanup_state" \
  FAKE_DOCKER_MODE=cleanup-error \
  "$VALIDATE_SCRIPT" --backup "$BACKUP_DIR" --check-sql "$CHECK_SQL" \
  >"$WORK_DIR/cleanup.out" 2>"$WORK_DIR/cleanup.err"; then
  fail 'validator returned success when cleanup ownership could not be inspected'
fi
[[ ! -e "$cleanup_state/rm-calls" ]] \
  || fail 'validator removed a container without confirming exact ID and run label'

printf 'PASS: restore readiness retry and cleanup failure handling\n'
