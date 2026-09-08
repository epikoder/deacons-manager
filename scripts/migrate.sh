#!/usr/bin/env bash
#
# Apply migrations to a real database, no Docker involved.
# (docker/apply-migrations.sh is the local-stack equivalent.)
#
#   ./scripts/migrate.sh              # show what is pending, ask, then apply
#   ./scripts/migrate.sh --yes        # no prompt, for CI
#   ./scripts/migrate.sh --info       # show status and exit, change nothing
#   ./scripts/migrate.sh --revert     # roll back the most recent migration
#
# Reads DATABASE_URL from .env in the repo root (an existing environment variable
# wins, so CI can inject it). Migrations are applied with `sqlx migrate run`,
# which records them in _sqlx_migrations - never replay these by hand with psql
# on a database sqlx manages, or the two views of history diverge.
#
# After migrating it runs the PostgREST housekeeping sqlx knows nothing about:
# checking app.jwt_secret is set, confirming the connection role can assume
# app_client, and reloading the schema cache.
set -euo pipefail
cd "$(dirname "$0")/.."

YES=0; INFO_ONLY=0; REVERT=0
for arg in "$@"; do
    case "$arg" in
        --yes|-y)  YES=1 ;;
        --info)    INFO_ONLY=1 ;;
        --revert)  REVERT=1 ;;
        -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

die() { echo "error: $*" >&2; exit 1; }

# Read one key out of .env. Tolerates `export`, quotes and trailing CR; takes the
# last occurrence, which is how a shell sourcing the file would resolve it.
read_env() {
    local key=$1 line
    [[ -f .env ]] || return 1
    line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" .env | tail -1) || return 1
    line=${line#*=}
    line=${line%$'\r'}
    if [[ $line == \"*\" && $line == *\" ]]; then line=${line:1:${#line}-2}
    elif [[ $line == \'*\' && $line == *\' ]]; then line=${line:1:${#line}-2}
    fi
    printf '%s' "$line"
}

DATABASE_URL="${DATABASE_URL:-$(read_env DATABASE_URL || true)}"
[[ -n ${DATABASE_URL:-} ]] || die "DATABASE_URL is not set and not found in $(pwd)/.env"

# Never print the URL - it carries the password. Show enough to confirm the target.
safe_target() {
    python3 - "$DATABASE_URL" <<'PY' 2>/dev/null || echo "(unparsed)"
import sys, urllib.parse as u
p = u.urlparse(sys.argv[1])
print(f"{p.hostname or '?'}:{p.port or 5432}{p.path or ''} as {p.username or '?'}")
PY
}

# Show the target before any tooling check, so a missing binary still tells you what
# this would have connected to.
echo "target: $(safe_target)"

command -v sqlx >/dev/null || die "sqlx not found. Install with:
  cargo install sqlx-cli --no-default-features --features native-tls,postgres"

HAVE_PSQL=1
command -v psql >/dev/null || HAVE_PSQL=0

echo
echo "migration status:"
sqlx migrate info --database-url "$DATABASE_URL" | sed 's/^/  /'

if [[ $INFO_ONLY -eq 1 ]]; then exit 0; fi

if [[ $REVERT -eq 1 ]]; then
    # sqlx reverts exactly one step; the .down.sql files here are written to be
    # reversible, but a revert on production is still a deliberate act.
    read -rp "revert the most recent migration on $(safe_target)? [y/N] " a
    [[ ${a:-} == [yY] ]] || { echo "aborted"; exit 1; }
    sqlx migrate revert --database-url "$DATABASE_URL"
    exit 0
fi

PENDING=$(sqlx migrate info --database-url "$DATABASE_URL" | grep -c "pending" || true)
if [[ $PENDING -eq 0 ]]; then
    echo
    echo "nothing pending."
else
    if [[ $YES -eq 0 ]]; then
        echo
        read -rp "apply $PENDING migration(s) to $(safe_target)? [y/N] " a
        [[ ${a:-} == [yY] ]] || { echo "aborted"; exit 1; }
    fi
    sqlx migrate run --database-url "$DATABASE_URL"
fi

# ---- PostgREST housekeeping -------------------------------------------------
if [[ $HAVE_PSQL -eq 0 ]]; then
    cat <<'EOF'

psql not found, so the PostgREST steps were skipped. Run these yourself:

  -- the connection role must be able to assume app_client, or its tokens are rejected
  GRANT app_client TO <your authenticator role>;
  -- PostgREST caches the schema at boot; new RPCs 404 with PGRST202 until it reloads
  NOTIFY pgrst, 'reload schema';
EOF
    exit 0
fi

echo
echo "post-migration checks:"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qtAX <<'SQL' | sed 's/^/  /'
SELECT CASE
  WHEN coalesce(current_setting('app.jwt_secret', TRUE), '') = ''
    THEN 'FAIL app.jwt_secret is empty - login() and app_token() cannot sign; set it with ALTER DATABASE ... SET "app.jwt_secret"'
  ELSE 'ok   app.jwt_secret is set'
END;

SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_client')
    THEN 'FAIL app_client role missing - did the app_clients migration run?'
  WHEN EXISTS (
    SELECT 1 FROM pg_auth_members am
    JOIN pg_roles m ON m.oid = am.member
    JOIN pg_roles g ON g.oid = am.roleid
    WHERE g.rolname = 'app_client' AND m.rolcanlogin)
    THEN 'ok   a login role can assume app_client'
  ELSE 'FAIL no login role can assume app_client - run: GRANT app_client TO <authenticator role>'
END;

SELECT 'ok   registered app clients: ' || count(*) FROM auth.apps WHERE disabled_at IS NULL;
SELECT 'ok   namespaces mapped: ' || count(*) FROM auth.app_namespaces;
SQL

# Safe to repeat, and harmless when PostgREST is not listening.
psql "$DATABASE_URL" -qtAX -c "NOTIFY pgrst, 'reload schema';" >/dev/null
echo "  ok   asked PostgREST to reload its schema cache"

echo
echo "done. If namespaces are still 0, seed auth.app_namespaces - and run"
echo "docker/check-sources.sql first to see the real orders.source values."
