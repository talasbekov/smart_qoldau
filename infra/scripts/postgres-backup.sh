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

cleanup() {
  local status=$?
  if (( published == 0 )) && [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf -- "$temporary_directory"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

chmod 700 "$temporary_directory"
dump_file="$temporary_directory/database.dump"

if ! docker exec --interactive "$container" sh -ceu '
  escape_pgpass() {
    printf "%s" "$1" | sed -e "s/\\\\/\\\\\\\\/g" -e "s/:/\\\\:/g"
  }

  umask 077
  pgpass_file="$(mktemp /tmp/smartqoldau-pgpass.XXXXXX)"
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

  PGPASSFILE="$pgpass_file" pg_dump \
    --format=custom \
    --serializable-deferrable \
    --no-password \
    --host="$1" \
    --port="$2" \
    --dbname="$3" \
    --username="$4"
' sh "$host" "$port" "$database" "$database_user" \
  <"$password_file" >"$dump_file"; then
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
