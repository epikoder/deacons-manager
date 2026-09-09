#!/usr/bin/env bash
#
# Register a third-party app client and the namespaces it may read.
#
#   ./scripts/register-app-client.sh \
#       --name "deacons-resource-manager" \
#       --client-id drm-prod \
#       --namespaces "Ella,Emeka,Arinze,Nnacho"
#
#   --namespaces takes a comma separated list. A bare name maps to the source of
#   the same name, which is the usual case: deacons-manager stamps orders.source
#   with the name it registered the poller under. Use NS=src1|src2 to point one
#   namespace at several sources, mirroring affiliates.source_list.
#
#   --rotate   replace the secret of an existing client
#
# Run docker/check-sources.sql first: namespaces must match the real
# orders.source values, and only this tells you what those are.
#
# The secret is generated here, printed once, and stored only as a bcrypt hash.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=""; CLIENT_ID=""; NAMESPACES=""; ROTATE=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)       NAME=${2:-}; shift 2 ;;
        --client-id)  CLIENT_ID=${2:-}; shift 2 ;;
        --namespaces) NAMESPACES=${2:-}; shift 2 ;;
        --rotate)     ROTATE=1; shift ;;
        -h|--help)    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

REPORTED=0
die() { echo "error: $*" >&2; REPORTED=1; exit 1; }

# Random token with no pipeline, so nothing can die on SIGPIPE.
random_token() {
    python3 -c "import secrets,string;print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range($1)))"
}

# set -e aborting with no explanation is what made the SIGPIPE above so hard to see.
trap 'rc=$?; [[ $rc -ne 0 && $REPORTED -eq 0 ]] && echo "error: aborted unexpectedly with exit $rc" >&2; exit $rc' EXIT

[[ -n $NAME ]]       || die "--name is required"
[[ -n $CLIENT_ID ]]  || die "--client-id is required"
[[ -n $NAMESPACES ]] || die "--namespaces is required"

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
command -v python3 >/dev/null || die "python3 not found"

# Alphanumeric: this ends up in a .env file and in an HTTP JSON body, and both are
# happier without escaping.
#
# Not `tr -dc ... </dev/urandom | head -c N`: head closes the pipe at N bytes, tr dies
# on SIGPIPE, and under `set -o pipefail -e` that aborts the whole script silently
# before a single line of output.
SECRET=$(random_token 48)

EXISTS=$(psql "$DATABASE_URL" -qtAX --set=cid="$CLIENT_ID" <<'SQL'
SELECT count(*) FROM auth.apps WHERE client_id = :'cid';
SQL
)
if [[ $EXISTS -gt 0 && $ROTATE -eq 0 ]]; then
    echo "client '$CLIENT_ID' already exists; namespaces will be updated, secret left alone."
    echo "Pass --rotate to issue a new secret."
fi

# Everything is passed as psql variables, never spliced into the SQL by the shell.
psql "$DATABASE_URL" -qtAX -v ON_ERROR_STOP=1 \
     --set=name="$NAME" --set=cid="$CLIENT_ID" --set=secret="$SECRET" \
     --set=ns="$NAMESPACES" --set=rotate="$ROTATE" <<'SQL' | sed 's/^/  /'
BEGIN;

-- On a fresh insert the BEFORE INSERT trigger bcrypts the raw secret. On conflict
-- the secret is deliberately left alone here: Postgres fires the insert trigger
-- BEFORE detecting the conflict, so `excluded.client_secret` is already a hash,
-- and letting DO UPDATE write it would make the BEFORE UPDATE trigger hash it a
-- second time - storing bcrypt(bcrypt(secret)), which never authenticates.
INSERT INTO auth.apps (name, client_id, client_secret)
VALUES (:'name', :'cid', :'secret')
ON CONFLICT (client_id) DO UPDATE
  SET name = excluded.name,
      disabled_at = NULL;

-- Rotation is a separate UPDATE of the raw secret, so the trigger hashes it once.
-- No-op unless --rotate was passed.
UPDATE auth.apps SET client_secret = :'secret'
WHERE client_id = :'cid' AND :'rotate' = '1';

WITH spec AS (
  SELECT btrim(split_part(item, '=', 1)) AS ns,
         CASE WHEN position('=' IN item) > 0
              THEN (SELECT array_agg(btrim(x)) FROM unnest(string_to_array(split_part(item, '=', 2), '|')) x)
              ELSE ARRAY[btrim(split_part(item, '=', 1))]
         END AS sources
  FROM unnest(string_to_array(:'ns', ',')) AS item
  WHERE btrim(item) <> ''
)
INSERT INTO auth.app_namespaces (app_id, namespace, source_list)
SELECT a.id, spec.ns, spec.sources
FROM auth.apps a, spec
WHERE a.client_id = :'cid'
ON CONFLICT (app_id, namespace) DO UPDATE SET source_list = excluded.source_list;

COMMIT;

SELECT 'namespace ' || rpad(n.namespace, 12) || ' -> ' || array_to_string(n.source_list, ', ')
     || coalesce((SELECT '   (' || count(*) || ' orders, ' || count(*) FILTER (WHERE o.delivery_status = 'delivered') || ' delivered)'
                  FROM public.orders o WHERE o.source ILIKE ANY (n.source_list)), '')
FROM auth.app_namespaces n
JOIN auth.apps a ON a.id = n.app_id
WHERE a.client_id = :'cid'
ORDER BY n.namespace;
SQL

echo
if [[ $EXISTS -eq 0 || $ROTATE -eq 1 ]]; then
    cat <<EOF
Put these in deacons-resource-manager/.env - the secret is not recoverable later:

  PGREST_URL="https://admin.prep50.ng/rest"
  PGREST_CLIENT_ID="$CLIENT_ID"
  PGREST_CLIENT_SECRET="$SECRET"
EOF
else
    echo "Namespaces updated. Existing secret kept."
fi
