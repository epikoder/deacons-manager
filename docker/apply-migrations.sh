#!/usr/bin/env bash
# Applies migrations/*.up.sql in filename order against the local compose database.
# The repo has no migration runner (scripts/migrate.ts is a one-off data fix), so
# this is a plain ordered psql replay - fine for a disposable dev database.
set -euo pipefail
cd "$(dirname "$0")/.."

JWT_SECRET="${JWT_SECRET:-dev-only-jwt-secret-change-me-0123456789}"
PSQL=(docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d deacons)

# --fresh drops and recreates the schema so the whole chain is replayed from zero.
if [[ "${1:-}" == "--fresh" ]]; then
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DROP DATABASE IF EXISTS deacons WITH (FORCE);
CREATE DATABASE deacons;
SQL
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$
DECLARE r text;
BEGIN
  FOR r IN SELECT unnest(ARRAY['app_client','admin','authenticated','anon','authenticator']) LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('DROP OWNED BY %I CASCADE', r);
      EXECUTE format('DROP ROLE %I', r);
    END IF;
  END LOOP;
END $$;
SQL
fi

# PostgREST connects as `authenticator` and SET ROLE's to anon/admin/app_client.
# The migrations assume these exist but never create the connecting role itself.
"${PSQL[@]}" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator';
  END IF;
END \$\$;
-- 20241015022116_auth.up.sql does a session-scoped SET, which does not survive.
-- Persist it on the database so signing works for every PostgREST connection.
ALTER DATABASE deacons SET "app.jwt_secret" = '${JWT_SECRET}';
SQL

for f in migrations/*.up.sql; do
  printf '\n>>> %s\n' "$f"
  "${PSQL[@]}" < "$f"
done

"${PSQL[@]}" <<'SQL'
GRANT anon, authenticated, "admin" TO authenticator;
-- PostgREST caches the schema at boot. Without this, any RPC added by a migration
-- 404s with PGRST202 ("no matches were found in the schema cache") until it restarts.
NOTIFY pgrst, 'reload schema';
SQL
echo
echo "migrations applied"
