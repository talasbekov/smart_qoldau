#!/usr/bin/env bash
# Run the repository's existing, non-mutating static and unit-test checks.
# This script deliberately does not install dependencies, generate code, run
# migrations/seeds, start infrastructure, or execute e2e tests.

set -u
set -o pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

declare -a SELECTED_PACKAGES=()
declare -a RESULT_NAMES=()
declare -a RESULT_STATES=()
declare -a RESULT_DETAILS=()
RUN_INTEGRATION=0

usage() {
  cat <<'EOF'
Usage: scripts/check-all.sh [--package NAME]... [--integration]

Run existing non-mutating lint, analysis, and unit-test commands. Dependencies
must already be installed; this command never runs npm ci, flutter pub get,
code generation, migrations, seeds, or e2e tests.

Options:
  --package NAME     Check one package (repeatable or comma-separated):
                     backend, web, admin, shared, app-client, app-expert, all
  --integration      Also run backend test:integration. This is opt-in because
                     it connects to the supplied dedicated test services.
  -h, --help         Show this help.

Integration prerequisites:
  Select backend, set CHECK_ALL_DEDICATED_TEST_ENV=1, and provide DATABASE_URL,
  REDIS_URL, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_DOCUMENTS,
  S3_BUCKET_AVATARS, and S3_BUCKET_CONTENT. DATABASE_URL must contain "test".
  All three service URLs must point to localhost/127.0.0.1/[::1]. The script
  does not create, migrate, seed, or clean those services.

Exit status: 0 when every selected check passes; 1 when a check fails; 2 when
a required command or installed dependency is unavailable (or integration
preconditions are not satisfied). When both failures and unavailable checks
occur, a failed check takes precedence and the exit status is 1.
EOF
}

select_package() {
  local package="$1"
  case "$package" in
    backend|web|admin|shared|app-client|app-expert)
      SELECTED_PACKAGES+=("$package")
      ;;
    all)
      SELECTED_PACKAGES=(backend web admin shared app-client app-expert)
      ;;
    *)
      printf 'Unknown package: %s\n' "$package" >&2
      usage >&2
      exit 64
      ;;
  esac
}

is_selected() {
  local needle="$1" package
  for package in "${SELECTED_PACKAGES[@]}"; do
    [[ "$package" == "$needle" ]] && return 0
  done
  return 1
}

record_result() {
  RESULT_NAMES+=("$1")
  RESULT_STATES+=("$2")
  RESULT_DETAILS+=("$3")
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

run_npm_check() {
  local package="$1" label="$2"
  shift 2
  local directory="$REPO_ROOT/$package"

  if ! has_command npm; then
    record_result "$label" UNAVAILABLE 'npm is not on PATH'
    return
  fi
  if [[ ! -d "$directory/node_modules" ]]; then
    record_result "$label" UNAVAILABLE "$package/node_modules is absent (run npm ci separately)"
    return
  fi

  printf '\n==> %s\n' "$label"
  if (cd -- "$directory" && npm "$@"); then
    record_result "$label" PASS ''
  else
    record_result "$label" FAILED "npm $*"
  fi
}

run_flutter_check() {
  local package="$1" label="$2"
  shift 2
  local directory="$REPO_ROOT/$package"

  if ! has_command flutter; then
    record_result "$label" UNAVAILABLE 'flutter is not on PATH'
    return
  fi
  if [[ ! -f "$directory/.dart_tool/package_config.json" ]]; then
    record_result "$label" UNAVAILABLE "$package dependencies are absent (run flutter pub get separately)"
    return
  fi

  printf '\n==> %s\n' "$label"
  if (cd -- "$directory" && flutter "$@" --no-pub); then
    record_result "$label" PASS ''
  else
    record_result "$label" FAILED "flutter $* --no-pub"
  fi
}

is_local_service_url() {
  [[ "$1" =~ ^[a-zA-Z][a-zA-Z0-9+.-]*://([^/@]+@)?(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?(/|$) ]]
}

database_path_is_test() {
  local authority_and_path database_path
  authority_and_path="${1#*://}"
  [[ "$authority_and_path" == */* ]] || return 1
  database_path="${authority_and_path#*/}"
  database_path="${database_path%%\?*}"
  database_path="${database_path%%\#*}"
  [[ "$database_path" == *test* ]]
}

check_integration_preconditions() {
  local required
  if [[ "${CHECK_ALL_DEDICATED_TEST_ENV:-}" != '1' ]]; then
    record_result backend-integration UNAVAILABLE 'set CHECK_ALL_DEDICATED_TEST_ENV=1 to acknowledge dedicated services'
    return 1
  fi
  for required in DATABASE_URL REDIS_URL S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET_DOCUMENTS S3_BUCKET_AVATARS S3_BUCKET_CONTENT; do
    if [[ -z "${!required:-}" ]]; then
      record_result backend-integration UNAVAILABLE "$required is not set"
      return 1
    fi
  done
  if ! database_path_is_test "$DATABASE_URL"; then
    record_result backend-integration UNAVAILABLE 'DATABASE_URL must name a dedicated test database (contain "test")'
    return 1
  fi
  for required in DATABASE_URL REDIS_URL S3_ENDPOINT; do
    if ! is_local_service_url "${!required}"; then
      record_result backend-integration UNAVAILABLE "$required must point to a local dedicated service"
      return 1
    fi
  done
  return 0
}

run_integration() {
  if ! is_selected backend; then
    printf '%s\n' '--integration requires --package backend (or the default all packages)' >&2
    exit 64
  fi
  if ! check_integration_preconditions; then
    return
  fi
  run_npm_check backend backend-integration run test:integration -- --runInBand
}

print_summary() {
  local index pass=0 failed=0 unavailable=0
  printf '\n=== check-all summary ===\n'
  for index in "${!RESULT_NAMES[@]}"; do
    printf '%-28s %-11s %s\n' "${RESULT_NAMES[index]}" "${RESULT_STATES[index]}" "${RESULT_DETAILS[index]}"
    case "${RESULT_STATES[index]}" in
      PASS) ((pass += 1)) ;;
      FAILED) ((failed += 1)) ;;
      UNAVAILABLE) ((unavailable += 1)) ;;
    esac
  done
  printf 'Totals: pass=%d failed=%d unavailable=%d\n' "$pass" "$failed" "$unavailable"

  if (( failed > 0 )); then
    return 1
  fi
  if (( unavailable > 0 )); then
    return 2
  fi
  return 0
}

while (( $# > 0 )); do
  case "$1" in
    --package)
      [[ $# -ge 2 ]] || { printf '%s\n' '--package needs a value' >&2; exit 64; }
      IFS=',' read -r -a requested_packages <<< "$2"
      for package in "${requested_packages[@]}"; do
        select_package "$package"
      done
      shift 2
      ;;
    --integration)
      RUN_INTEGRATION=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if (( ${#SELECTED_PACKAGES[@]} == 0 )); then
  SELECTED_PACKAGES=(backend web admin shared app-client app-expert)
fi

if is_selected backend; then
  run_npm_check backend backend-lint run lint
  run_npm_check backend backend-unit run test -- --runInBand
fi
if is_selected web; then
  run_npm_check web web-lint run lint
  run_npm_check web web-unit run test -- --runInBand
fi
if is_selected admin; then
  run_npm_check admin admin-lint run lint
  run_npm_check admin admin-unit run test
fi
if is_selected shared; then
  run_flutter_check packages/shared shared-analyze analyze
  run_flutter_check packages/shared shared-unit test
fi
if is_selected app-client; then
  run_flutter_check app_client app-client-analyze analyze
  run_flutter_check app_client app-client-unit test
fi
if is_selected app-expert; then
  run_flutter_check app_expert app-expert-analyze analyze
  run_flutter_check app_expert app-expert-unit test
fi
if (( RUN_INTEGRATION )); then
  run_integration
fi

print_summary
