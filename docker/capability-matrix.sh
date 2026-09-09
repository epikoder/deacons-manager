#!/usr/bin/env bash
# What can one app client actually do?
#
# Answers the question directly: a client registered for several namespaces can
# obtain a token for each, but any single token is confined to one namespace, and
# to namespaces the client was registered for.
set -uo pipefail
BASE="${PGREST_URL:-http://localhost:3001}"
CID="${CLIENT_ID:-drm-local}"; SEC="${CLIENT_SECRET:-drm-local-secret}"
CT='Content-Type: application/json'
YEAR=$(date +%Y); MONTH=$(date +%-m)

mint() { curl -sS -X POST "$BASE/rpc/app_token" -H "$CT" \
  -d "{\"client_id\":\"$CID\",\"client_secret\":\"$SEC\",\"namespace\":\"$1\"}" \
  | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("access_token",""))
except Exception: print("")'; }
code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
earn() { curl -sS -X POST "$BASE/rpc/me_earning_by_day" -H "Authorization: Bearer $1" -H "$CT" \
  -d "{\"month\":$MONTH,\"year\":$YEAR}" | python3 -c 'import json,sys
try: print(sum(r["earning"] or 0 for r in json.load(sys.stdin)))
except Exception: print("ERR")'; }
ns_of() { curl -sS -X POST "$BASE/rpc/me_namespace" -H "Authorization: Bearer $1" -H "$CT" -d '{}' \
  | python3 -c 'import json,sys
try: print(json.load(sys.stdin)[0]["namespace"])
except Exception: print("ERR")'; }

echo "client: $CID"
echo
echo "1. Which namespaces can this client obtain a token for?"
for ns in Ella Emeka Nnacho Arinze Nanyalove Bogus; do
  t=$(mint "$ns")
  if [[ -n $t ]]; then printf '   %-12s token issued   -> scope %s\n' "$ns" "$(ns_of "$t")"
  else printf '   %-12s REFUSED (not registered to this client)\n' "$ns"; fi
done

echo
echo "2. What does each token see? (earnings this month)"
# bash 3.2 (macOS default) has no associative arrays - keep it portable.
E_ELLA=$(earn "$(mint Ella)")
E_EMEKA=$(earn "$(mint Emeka)")
E_NNACHO=$(earn "$(mint Nnacho)")
printf '   %-12s %s\n' Ella "$E_ELLA"
printf '   %-12s %s\n' Emeka "$E_EMEKA"
printf '   %-12s %s\n' Nnacho "$E_NNACHO"
if [[ "$E_ELLA" != "$E_EMEKA" && "$E_EMEKA" != "$E_NNACHO" && "$E_ELLA" != "$E_NNACHO" ]]; then
  echo "   -> distinct per namespace: one token cannot see another's figures"
else
  echo "   -> FAIL figures are not distinct"
fi

echo
echo "3. What can a single token (Ella) reach beyond its own RPCs?"
T=$(mint Ella)
for path in orders affiliates agents affiliate_orders configs; do
  printf '   GET /%-18s %s\n' "$path" "$(code "$BASE/$path" -H "Authorization: Bearer $T")"
done
# Build payloads in variables: a brace-quoted JSON literal inside "$( ... )" is
# brace-expanded by bash before quoting settles, splitting one argument into several.
P_ARG="{\"month\":$MONTH,\"year\":$YEAR,\"agent\":null,\"source_filter\":[\"Emeka\"]}"
P_USER='{"fname":"a","lname":"b","email":"x@y.com","password":"pw123456","role":"admin"}'
P_LOGIN='{"email":"a@b.com","password":"x"}'
printf '   %-24s %s   <- cannot name another source\n' "rpc/get_earning_by_day" \
  "$(code -X POST "$BASE/rpc/get_earning_by_day" -H "Authorization: Bearer $T" -H "$CT" -d "$P_ARG")"
printf '   %-24s %s\n' "rpc/create_user" \
  "$(code -X POST "$BASE/rpc/create_user" -H "Authorization: Bearer $T" -H "$CT" -d "$P_USER")"
printf '   %-24s %s\n' "rpc/login" \
  "$(code -X POST "$BASE/rpc/login" -H "Authorization: Bearer $T" -H "$CT" -d "$P_LOGIN")"

echo
echo "4. Is the unmapped source excluded from every token?"
for ns in Ella Emeka Nnacho; do
  t=$(mint "$ns")
  got=$(curl -sS -X POST "$BASE/rpc/me_namespace" -H "Authorization: Bearer $t" -H "$CT" -d '{}' \
        | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)[0]["source_list"]))')
  printf '   %-12s sources: %-14s Nanyalove present: %s\n' "$ns" "$got" \
    "$([[ $got == *Nanyalove* ]] && echo YES || echo no)"
done
