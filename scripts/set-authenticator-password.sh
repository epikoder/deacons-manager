#!/usr/bin/env bash
#
# Set a password on the `authenticator` role and print the db-uri line for
# postgrest.conf. Kept out of the migration because a credential does not belong
# in a versioned SQL file.
#
#   ./scripts/set-authenticator-password.sh            # generate a strong password
#   ./scripts/set-authenticator-password.sh --show     # also print it once
#
# Reads DATABASE_URL from .env, same as scripts/migrate.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

SHOW=0
for a in "$@"; do
    case "$a" in
        --show) SHOW=1 ;;
        -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "unknown option: $a" >&2; exit 2 ;;
    esac
done

die() { echo "error: $*" >&2; exit 1; }

read_env() {
    local key=$1 line
    [[ -f .env ]] || return 1
    line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" .env | tail -1) || return 1
    line=${line#*=}; line=${line%$'\r'}
    if [[ $line == \"*\" && $line == *\" ]]; then line=${line:1:${#line}-2}
    elif [[ $line == \'*\' && $line == *\' ]]; then line=${line:1:${#line}-2}
    fi
    printf '%s' "$line"
}

DATABASE_URL="${DATABASE_URL:-$(read_env DATABASE_URL || true)}"
[[ -n ${DATABASE_URL:-} ]] || die "DATABASE_URL is not set and not found in $(pwd)/.env"
command -v psql >/dev/null || die "psql not found"

psql "$DATABASE_URL" -qtAX -c "SELECT 1 FROM pg_roles WHERE rolname='authenticator'" | grep -q 1 \
    || die "role authenticator does not exist - run ./scripts/migrate.sh first"

# Alphanumeric only: the password goes into a URI in postgrest.conf, and percent
# encoding there is a reliable source of confusing failures.
PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40)

# The password is passed as a psql variable and quoted into the statement with
# format(%L), so it is never interpolated into SQL text by the shell.
psql "$DATABASE_URL" -qtAX -v ON_ERROR_STOP=1 --set=pw="$PASSWORD" <<'SQL' >/dev/null
SELECT format('ALTER ROLE authenticator LOGIN PASSWORD %L', :'pw') \gexec
SQL

# Rebuild the URI against the same host/port/database the migrations use, so the
# line below is correct for this server rather than a guess.
LINE=$(DB_URL="$DATABASE_URL" PW="$PASSWORD" python3 - <<'PY'
import os, urllib.parse as u
p = u.urlparse(os.environ["DB_URL"])
host = p.hostname or "127.0.0.1"; port = p.port or 5432; db = (p.path or "/postgres").lstrip("/")
print(f'db-uri = "postgres://authenticator:{os.environ["PW"]}@{host}:{port}/{db}"')
PY
)

echo "password set on role authenticator."
echo
echo "Put this in postgrest.conf, then restart PostgREST:"
if [[ $SHOW -eq 1 ]]; then
    echo "  $LINE"
else
    echo "  ${LINE//$PASSWORD/<password shown with --show>}"
    echo
    echo "Re-run with --show to print the password (it is not stored anywhere)."
fi
echo
echo "Leave db-anon-role = \"anon\" as it is. To roll back, point db-uri at the"
echo "previous superuser role and restart - nothing else needs to change."
