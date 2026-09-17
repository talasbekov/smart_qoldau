#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: minio-restore-validate.sh \
  --backup BACKUP_DIRECTORY --minio-image IMAGE --expectations FILE \
  [--operation-timeout SECONDS]

Verify checksums and inventories, restore the cold MinIO snapshot into a new
network-isolated disposable container, then check expected object SHA-256,
content type, and selected metadata. The container is removed by exact ID and
run label. This validates the MinIO artifact only; it is not a production
restore command and does not establish database/object point-in-time parity.
Each Docker/`mc` phase is a tracked child bounded by --operation-timeout
(default 300 seconds).
EOF
}

die() {
  printf 'minio-restore-validate: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local remaining="$2"
  (( remaining >= 2 )) || die "$option requires a value"
}

backup=''
minio_image=''
expectations=''
operation_timeout=300

while (( $# > 0 )); do
  case "$1" in
    --backup)
      require_value "$1" "$#"
      backup="$2"
      shift 2
      ;;
    --minio-image)
      require_value "$1" "$#"
      minio_image="$2"
      shift 2
      ;;
    --expectations)
      require_value "$1" "$#"
      expectations="$2"
      shift 2
      ;;
    --operation-timeout)
      require_value "$1" "$#"
      operation_timeout="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$backup" ]] || die '--backup is required'
[[ -n "$minio_image" ]] || die '--minio-image is required; no restore image is selected implicitly'
[[ -n "$expectations" ]] || die '--expectations is required; validation must assert object invariants'
[[ "$operation_timeout" =~ ^[1-9][0-9]*$ ]] && (( operation_timeout <= 86400 )) \
  || die '--operation-timeout must be between 1 and 86400 seconds'
[[ -d "$backup" && ! -L "$backup" ]] || die 'backup must be a directory, not a symlink'
[[ -f "$expectations" && ! -L "$expectations" ]] \
  || die 'expectations must be a regular file, not a symlink'
for filename in BUCKETS.jsonl OBJECTS.jsonl manifest.json minio-data.tar SHA256SUMS; do
  [[ -f "$backup/$filename" && ! -L "$backup/$filename" ]] \
    || die "backup does not contain a regular $filename"
done
for command_name in docker jq sha256sum mktemp tar cmp base64 timeout; do
  command -v "$command_name" >/dev/null 2>&1 || die "$command_name is required"
done

mapfile -t checksum_lines <"$backup/SHA256SUMS"
expected_files=(BUCKETS.jsonl OBJECTS.jsonl manifest.json minio-data.tar)
(( ${#checksum_lines[@]} == ${#expected_files[@]} )) \
  || die 'SHA256SUMS must contain exactly four entries'
for index in "${!expected_files[@]}"; do
  [[ "${checksum_lines[$index]}" =~ ^[[:xdigit:]]{64}\ \ ${expected_files[$index]}$ ]] \
    || die 'SHA256SUMS contains an unexpected or malformed entry'
done
(
  cd -- "$backup"
  sha256sum --check --strict SHA256SUMS >/dev/null
) || die 'backup checksum mismatch'

jq -e '
  .format == "smartqoldau-minio-backup-v1"
  and (.createdAt | type == "string")
  and (.minioImageId | test("^sha256:[0-9a-fA-F]{64}$"))
  and (.consistency | type == "string")
  and (.exclusions | type == "string")
' "$backup/manifest.json" >/dev/null || die 'backup manifest is invalid'

image_id="$(timeout --signal=TERM --kill-after=2 15 docker image inspect \
  --format '{{.Id}}' "$minio_image" 2>/dev/null)" \
  || die "MinIO image is not available locally: $minio_image"
manifest_image_id="$(jq -r '.minioImageId' "$backup/manifest.json")"
[[ "$image_id" == "$manifest_image_id" ]] \
  || die 'restore image ID does not match the image recorded by the backup'

jq -e '
  type == "object"
  and (keys == ["objects"])
  and (.objects | type == "array" and length > 0)
  and all(.objects[];
    (.bucket | type == "string" and length > 0)
    and (.key | type == "string" and length > 0)
    and (.sha256 | test("^[0-9a-f]{64}$"))
    and (.contentType | type == "string" and length > 0)
    and (.metadata | type == "object")
    and all(.metadata[]; type == "string")
  )
  and ((.objects | map([.bucket, .key] | @json) | unique | length) == (.objects | length))
' "$expectations" >/dev/null || die 'expectations file is invalid'

tar --list --file "$backup/minio-data.tar" \
  | awk '
      /^\// { exit 1 }
      /(^|\/)\.\.($|\/)/ { exit 1 }
    ' || die 'backup archive contains an unsafe path'
tar --list --file "$backup/minio-data.tar" >/dev/null \
  || die 'backup archive is not a readable tar file'

readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
readonly CONTAINER_NAME="smartqoldau-minio-restore-$RUN_ID"
readonly LABEL_KEY='com.smartqoldau.minio-restore-validation.run'
readonly LABEL="$LABEL_KEY=$RUN_ID"
work_directory="$(mktemp -d "${TMPDIR:-/tmp}/smartqoldau-minio-restore.XXXXXX")"
chmod 700 "$work_directory"
credential_env="$work_directory/restore.env"
restore_access="sqrestore${RUN_ID//[^a-zA-Z0-9]/}"
restore_access="${restore_access:0:20}"
restore_secret="$(printf '%s' "$RUN_ID-$RANDOM-$(date +%s%N)" | sha256sum | awk '{print $1}')"
printf 'MINIO_ROOT_USER=%s\nMINIO_ROOT_PASSWORD=%s\n' \
  "$restore_access" "$restore_secret" >"$credential_env"
chmod 600 "$credential_env"
container_id=''
active_child_pid=''

container_is_owned() {
  local ownership
  [[ -n "$container_id" ]] || return 1
  ownership="$(timeout --signal=KILL 5 docker container inspect \
    --format '{{.Id}}|{{ index .Config.Labels "com.smartqoldau.minio-restore-validation.run" }}' \
    "$container_id" 2>/dev/null)" || return 1
  [[ "$ownership" == "$container_id|$RUN_ID" ]]
}

container_uses_approved_image() {
  local created_image
  [[ -n "$container_id" ]] || return 1
  created_image="$(timeout --signal=KILL 5 docker container inspect --format '{{.Image}}' \
    "$container_id" 2>/dev/null)" || return 1
  [[ "$created_image" == "$image_id" ]]
}

resolve_owned_container_by_name() {
  local record resolved_id resolved_label
  [[ -z "$container_id" ]] || return 0
  if ! record="$(timeout --signal=KILL 5 docker container inspect \
    --format '{{.Id}}|{{ index .Config.Labels "com.smartqoldau.minio-restore-validation.run" }}' \
    "$CONTAINER_NAME" 2>/dev/null)"; then
    return 0
  fi
  resolved_id="${record%%|*}"
  resolved_label="${record#*|}"
  [[ "$resolved_id" =~ ^[[:xdigit:]]{64}$ && "$resolved_label" == "$RUN_ID" ]] \
    || return 1
  container_id="$resolved_id"
}

remove_owned_container() {
  resolve_owned_container_by_name || return 1
  [[ -n "$container_id" ]] || return 0
  if ! timeout --signal=KILL 5 docker container inspect "$container_id" >/dev/null 2>&1; then
    container_id=''
    return 0
  fi
  if ! container_is_owned; then
    printf 'minio-restore-validate: refusing cleanup without exact ID and run-label ownership\n' >&2
    return 1
  fi
  timeout --signal=KILL 10 docker rm --force "$container_id" >/dev/null || return 1
  if timeout --signal=KILL 5 docker container inspect "$container_id" >/dev/null 2>&1; then
    printf 'minio-restore-validate: container cleanup could not be confirmed\n' >&2
    return 1
  fi
  container_id=''
}

cleanup() {
  local status=$?
  if [[ -n "$active_child_pid" ]] && kill -0 "$active_child_pid" 2>/dev/null; then
    stop_active_child || status=1
  fi
  if ! remove_owned_container; then
    status=1
  fi
  rm -rf -- "$work_directory"
  exit "$status"
}

handle_signal() {
  local signal_status="$1"
  trap '' HUP INT TERM
  if [[ -n "$active_child_pid" ]]; then
    stop_active_child || signal_status=1
  fi
  remove_owned_container || signal_status=1
  exit "$signal_status"
}

trap cleanup EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

stop_active_child() {
  local deadline
  [[ -n "$active_child_pid" ]] || return 0
  kill -TERM "$active_child_pid" 2>/dev/null || true
  deadline=$((SECONDS + 5))
  while kill -0 "$active_child_pid" 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      kill -KILL "$active_child_pid" 2>/dev/null || true
      break
    fi
    sleep 0.1
  done
  wait "$active_child_pid" 2>/dev/null || true
  active_child_pid=''
}

run_managed() {
  local timeout_seconds="$1"
  shift
  local status
  timeout --signal=TERM --kill-after=2 "$timeout_seconds" "$@" <&0 &
  active_child_pid=$!
  if wait "$active_child_pid"; then
    status=0
  else
    status=$?
  fi
  active_child_pid=''
  return "$status"
}

container_id_file="$work_directory/container.id"
run_managed "$operation_timeout" docker create \
  --name "$CONTAINER_NAME" \
  --label "$LABEL" \
  --network none \
  --env-file "$credential_env" \
  "$image_id" server /data >"$container_id_file" \
  || die 'could not create isolated restore-validation MinIO'
IFS= read -r container_id <"$container_id_file"
rm -f -- "$container_id_file"
container_is_owned || die 'created restore container does not have expected ownership'
container_uses_approved_image || die 'created restore container does not use the approved image ID'
run_managed "$operation_timeout" docker cp - "$container_id:/data" \
  <"$backup/minio-data.tar" \
  || die 'could not load backup snapshot into isolated restore container before timeout'
run_managed "$operation_timeout" docker start "$container_id" >/dev/null \
  || die 'could not start isolated restore-validation MinIO'

validation_mc() {
  run_managed "$operation_timeout" docker exec "$container_id" sh -ceu '
    config_directory="$(mktemp -d /tmp/smartqoldau-minio-validation.XXXXXX)"
    trap "rm -rf -- \"$config_directory\"" EXIT
    printf "%s\n%s\n" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
      | MC_CONFIG_DIR="$config_directory" mc alias set restore \
        http://127.0.0.1:9000 --api S3v4 --path auto --quiet >/dev/null
    MC_CONFIG_DIR="$config_directory" mc "$@"
  ' sh "$@"
}

ready=0
for _attempt in $(seq 1 40); do
  if validation_mc ready restore >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
(( ready == 1 )) || die 'restored MinIO did not become ready'

validation_mc ls --json restore \
  >"$work_directory/.buckets.raw.jsonl" \
  2>"$work_directory/.mc-error" \
  || die 'could not inventory restored buckets'
timeout --signal=KILL 15 jq -cS \
  'if .status == "success" then {name, type} else error("mc ls failed") end' \
  "$work_directory/.buckets.raw.jsonl" >"$work_directory/BUCKETS.actual.jsonl" \
  2>/dev/null || die 'could not inventory restored buckets'
validation_mc stat --recursive --json restore \
  >"$work_directory/.objects.raw.jsonl" \
  2>"$work_directory/.mc-error" \
  || die 'could not inventory restored objects'
timeout --signal=KILL 15 jq -cS \
  'if .status == "success" then {checksum, etag, lastModified, metadata, name, size, type} else error("mc stat failed") end' \
  "$work_directory/.objects.raw.jsonl" >"$work_directory/OBJECTS.actual.jsonl" \
  2>/dev/null || die 'could not inventory restored objects'
rm -f -- "$work_directory/.buckets.raw.jsonl" \
  "$work_directory/.objects.raw.jsonl" "$work_directory/.mc-error"
cmp --silent "$backup/BUCKETS.jsonl" "$work_directory/BUCKETS.actual.jsonl" \
  || die 'restored bucket inventory differs from the backup'
cmp --silent "$backup/OBJECTS.jsonl" "$work_directory/OBJECTS.actual.jsonl" \
  || die 'restored object inventory differs from the backup'

expectation_index=0
while IFS= read -r encoded_expectation; do
  expectation_index=$((expectation_index + 1))
  expectation="$(printf '%s' "$encoded_expectation" | base64 --decode)"
  bucket="$(jq -r '.bucket' <<<"$expectation")"
  key="$(jq -r '.key' <<<"$expectation")"
  expected_sha="$(jq -r '.sha256' <<<"$expectation")"
  expected_content_type="$(jq -r '.contentType' <<<"$expectation")"
  expected_metadata="$(jq -c '.metadata' <<<"$expectation")"
  object_path="restore/$bucket/$key"
  object_data="$work_directory/expectation-$expectation_index.data"
  object_stat_file="$work_directory/expectation-$expectation_index.stat.json"
  object_error="$work_directory/expectation-$expectation_index.mc-error"

  validation_mc cat "$object_path" >"$object_data" 2>"$object_error" \
    || die "could not read expectation #$expectation_index"
  actual_sha="$(sha256sum "$object_data" | awk '{print $1}')"
  [[ "$actual_sha" == "$expected_sha" ]] \
    || die "SHA-256 mismatch for expectation #$expectation_index"
  validation_mc stat --json "$object_path" >"$object_stat_file" 2>"$object_error" \
    || die "could not stat expectation #$expectation_index"
  object_stat="$(<"$object_stat_file")"
  actual_content_type="$(jq -r '.metadata["Content-Type"] // empty' <<<"$object_stat")"
  [[ "$actual_content_type" == "$expected_content_type" ]] \
    || die "content type mismatch for expectation #$expectation_index"
  jq -e --argjson expected "$expected_metadata" '
    .metadata as $actual
    | $expected
    | to_entries
    | all(. as $entry | $actual[$entry.key] == $entry.value)
  ' <<<"$object_stat" >/dev/null 2>&1 \
    || die "metadata mismatch for expectation #$expectation_index"
  rm -f -- "$object_data" "$object_stat_file" "$object_error"
done < <(jq -r '.objects[] | @base64' "$expectations")

remove_owned_container || die 'restore completed but container cleanup could not be confirmed'
printf 'MinIO restore validation succeeded for %s\n' "$backup"
