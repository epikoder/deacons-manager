#!/usr/bin/env bash
# Exercises the app-client auth surface end to end against the local compose stack.
# Asserts both that a scoped token works AND that it cannot reach anything else.
set -uo pipefail
BASE="${PGREST_URL:-http://localhost:3001}"
pass=0; fail=0
mint() { curl -sS -X POST "$BASE/rpc/app_token" -H 'Content-Type: application/json' \
  -d "{\"client_id\":\"drm-local\",\"client_secret\":\"drm-local-secret\",\"namespace\":\"$1\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'; }
code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }
CT='Content-Type: application/json' 
check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then printf '  ok   %-52s %s\n' "$1" "$3"; pass=$((pass+1));
  else printf '  FAIL %-52s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1)); fi; }

YEAR=$(date +%Y); MONTH=$(date +%-m)
ELLA=$(mint Ella); EMEKA=$(mint Emeka)
[[ -n "$ELLA" && -n "$EMEKA" ]] || { echo "could not mint tokens"; exit 1; }

echo "== denied: tables and arg-taking RPCs =="
check "GET /orders"                    403 "$(code "$BASE/orders"     -H "Authorization: Bearer $ELLA")"
check "GET /affiliates"                403 "$(code "$BASE/affiliates" -H "Authorization: Bearer $ELLA")"
check "GET /agents"                    403 "$(code "$BASE/agents"     -H "Authorization: Bearer $ELLA")"
check "GET /affiliate_orders"          403 "$(code "$BASE/affiliate_orders" -H "Authorization: Bearer $ELLA")"
P_EARN_ARG='{"year":2026,"agent":null,"source_filter":["Emeka"]}'
P_ORD_ARG='{"month":1,"year":2026,"agent":null,"source_filter":["Emeka"]}'
check "POST /rpc/get_earning_by_month" 403 "$(code -X POST "$BASE/rpc/get_earning_by_month" -H "Authorization: Bearer $ELLA" -H "$CT" -d "$P_EARN_ARG")"
check "POST /rpc/get_orders_by_day"    403 "$(code -X POST "$BASE/rpc/get_orders_by_day"    -H "Authorization: Bearer $ELLA" -H "$CT" -d "$P_ORD_ARG")"

echo "== denied: bad credentials and unowned namespace =="
P_BADSEC='{"client_id":"drm-local","client_secret":"nope","namespace":"Ella"}'
P_BADNS='{"client_id":"drm-local","client_secret":"drm-local-secret","namespace":"Nkemobi"}'
P_YEAR='{"year":2026}'
check "wrong secret"                   403 "$(code -X POST "$BASE/rpc/app_token" -H "$CT" -d "$P_BADSEC")"
check "namespace not granted"          403 "$(code -X POST "$BASE/rpc/app_token" -H "$CT" -d "$P_BADNS")"
check "no token"                       401 "$(code -X POST "$BASE/rpc/me_earning_by_month" -H "$CT" -d "$P_YEAR")"

echo "== allowed: scoped RPCs =="
P_THISYEAR="{\"year\":$(date +%Y)}"
P_EMPTY='{}'
check "POST /rpc/me_earning_by_month"  200 "$(code -X POST "$BASE/rpc/me_earning_by_month" -H "Authorization: Bearer $ELLA" -H "$CT" -d "$P_THISYEAR")"
check "POST /rpc/me_namespace"         200 "$(code -X POST "$BASE/rpc/me_namespace"        -H "Authorization: Bearer $ELLA" -H "$CT" -d "$P_EMPTY")"

echo "== scope actually differs by token =="
sum() { curl -sS -X POST "$BASE/rpc/$1" -H "Authorization: Bearer $2" \
    -H 'Content-Type: application/json' -d "$3" \
    | python3 -c 'import json,sys; print(sum((r.get("earning") or r.get("order_count") or 0) for r in json.load(sys.stdin)))'; }
E_EARN=$(sum me_earning_by_day  "$ELLA"  "{\"month\":$MONTH,\"year\":$YEAR}")
M_EARN=$(sum me_earning_by_day  "$EMEKA" "{\"month\":$MONTH,\"year\":$YEAR}")
E_ORD=$(sum  me_orders_by_day   "$ELLA"  "{\"month\":$MONTH,\"year\":$YEAR}")
M_ORD=$(sum  me_orders_by_day   "$EMEKA" "{\"month\":$MONTH,\"year\":$YEAR}")
echo "  Ella  month earning=$E_EARN orders=$E_ORD"
echo "  Emeka month earning=$M_EARN orders=$M_ORD"
[[ "$E_EARN" != "$M_EARN" && "$E_ORD" != "$M_ORD" ]] \
  && { echo "  ok   scopes differ"; pass=$((pass+1)); } \
  || { echo "  FAIL scopes identical - token scope not applied"; fail=$((fail+1)); }

echo "== me_namespace metadata =="
curl -sS -X POST "$BASE/rpc/me_namespace" -H "Authorization: Bearer $ELLA"  -H 'Content-Type: application/json' -d '{}'; echo
curl -sS -X POST "$BASE/rpc/me_namespace" -H "Authorization: Bearer $EMEKA" -H 'Content-Type: application/json' -d '{}'; echo

echo "== earnings reconcile: sum(by day) over a year == sum(by month) =="
# get_earning_by_day and get_earning_by_month used different formulas and bucketed by
# different dates, so the affiliate page showed a "month" and a "total" that could not
# be derived from one another. They now share public.affiliate_order_earning().
recon() { # recon <token>
  local tok=$1 y; y=$(date +%Y)
  local dsum=0 m
  for m in $(seq 1 12); do
    local pd="{\"month\":$m,\"year\":$y}"
    local v; v=$(curl -sS -X POST "$BASE/rpc/me_earning_by_day" -H "Authorization: Bearer $tok" -H "$CT" -d "$pd" \
      | python3 -c 'import json,sys; print(sum(r["earning"] or 0 for r in json.load(sys.stdin)))')
    dsum=$((dsum + v))
  done
  local py="{\"year\":$y}"
  local msum; msum=$(curl -sS -X POST "$BASE/rpc/me_earning_by_month" -H "Authorization: Bearer $tok" -H "$CT" -d "$py" \
    | python3 -c 'import json,sys; print(sum(r["earning"] or 0 for r in json.load(sys.stdin)))')
  echo "$dsum $msum"
}
read -r DSUM MSUM <<<"$(recon "$ELLA")"
echo "  Ella by-day total=$DSUM  by-month total=$MSUM"
[[ "$DSUM" == "$MSUM" ]] && { printf '  ok   %-52s\n' "day and month totals reconcile"; pass=$((pass+1)); } \
                         || { printf '  FAIL %-52s\n' "day=$DSUM month=$MSUM do not reconcile"; fail=$((fail+1)); }
# An affiliate cannot earn more than the customer paid: E1 is 15000 with 1200 of books,
# 1500 office and 2000 delivery, so 10300 - not the 17300 the old add-the-costs formula gave.
[[ "$DSUM" -gt 0 && "$DSUM" -lt 100000 ]] && { printf '  ok   %-52s\n' "earnings within a sane range"; pass=$((pass+1)); } \
                                          || { printf '  FAIL %-52s\n' "earnings implausible: $DSUM"; fail=$((fail+1)); }

echo "== refresh rotation =="
RT=$(curl -sS -X POST "$BASE/rpc/app_token" -H 'Content-Type: application/json' \
  -d '{"client_id":"drm-local","client_secret":"drm-local-secret","namespace":"Ella"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["refresh_token"])')
NEW=$(curl -sS -X POST "$BASE/rpc/app_refresh_token" -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$RT\"}")
NRT=$(echo "$NEW" | python3 -c 'import json,sys; print(json.load(sys.stdin)["refresh_token"])')
# Tokens must differ: without a jti in the payload two tokens minted in the same second
# are byte identical and rotation silently does nothing.
[[ "$RT" != "$NRT" ]] && { printf '  ok   %-52s\n' "refresh rotates to a new token"; pass=$((pass+1)); } \
                      || { printf '  FAIL %-52s\n' "refresh returned an identical token"; fail=$((fail+1)); }
P_OLD="{\"refresh_token\":\"$RT\"}"
P_NEWRT="{\"refresh_token\":\"$NRT\"}"
check "consumed refresh token rejected" 403 "$(code -X POST "$BASE/rpc/app_refresh_token" -H "$CT" -d "$P_OLD")"
check "rotated refresh token accepted"  200 "$(code -X POST "$BASE/rpc/app_refresh_token" -H "$CT" -d "$P_NEWRT")"

echo "== admin path unaffected by the REVOKE ... FROM PUBLIC =="
AT=$(curl -sS -X POST "$BASE/rpc/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@prep50.com.ng","password":"secret123"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
if [[ -z "$AT" ]]; then
  printf '  skip admin checks (no admin@prep50.com.ng; see docker/seed-dev.sql)\n'
else
  check "admin GET /affiliates"              200 "$(code "$BASE/affiliates?select=fullname" -H "Authorization: Bearer $AT")"
  check "admin GET /orders"                  200 "$(code "$BASE/orders?select=id&limit=1"   -H "Authorization: Bearer $AT")"
  P_ADMIN="{\"month\":$MONTH,\"year\":$YEAR,\"agent\":null,\"source_filter\":[\"Ella\"]}"
  check "admin arg-taking get_earning_by_day" 200 "$(code -X POST "$BASE/rpc/get_earning_by_day" -H "Authorization: Bearer $AT" -H "$CT" -d "$P_ADMIN")"
fi

echo "== create_user (auth.create_user used to insert a nonexistent fullname column) =="
if [[ -z "${AT:-}" ]]; then
  printf '  skip create_user checks (no admin token)\n'
else
  NEW_EMAIL="cu-$$@prep50.com.ng"
  P_NEWUSER="{\"fname\":\"Chidi\",\"lname\":\"Okonkwo\",\"email\":\"$NEW_EMAIL\",\"password\":\"pw123456\",\"role\":\"authenticated\"}"
  P_ESCALATE="{\"fname\":\"E\",\"lname\":\"V\",\"email\":\"esc-$$@prep50.com.ng\",\"password\":\"pw123456\",\"role\":\"postgres\"}"
  check "admin create_user"                 200 "$(code -X POST "$BASE/rpc/create_user" -H "Authorization: Bearer $AT"   -H "$CT" -d "$P_NEWUSER")"
  check "role=postgres refused"             403 "$(code -X POST "$BASE/rpc/create_user" -H "Authorization: Bearer $AT"   -H "$CT" -d "$P_ESCALATE")"
  check "app_client cannot create_user"     403 "$(code -X POST "$BASE/rpc/create_user" -H "Authorization: Bearer $ELLA" -H "$CT" -d "$P_NEWUSER")"
  check "anon cannot create_user"           401 "$(code -X POST "$BASE/rpc/create_user"                                  -H "$CT" -d "$P_NEWUSER")"

  # The created user must be able to log in, and the name must land where
  # src/utils/auth.ts:makeUser reads it (user_raw_meta_data.fname / .lname).
  P_NEWLOGIN="{\"email\":\"$NEW_EMAIL\",\"password\":\"pw123456\"}"
  NAME=$(curl -sS -X POST "$BASE/rpc/login" -H "$CT" -d "$P_NEWLOGIN" | python3 -c '
import json,sys,base64
t = json.load(sys.stdin).get("access_token")
if not t:
    print("LOGIN-FAILED"); raise SystemExit
p = t.split(".")[1]; p += "=" * (-len(p) % 4)
m = json.loads(base64.urlsafe_b64decode(p))["user"]["user_raw_meta_data"]
print(m.get("lname","") + "-" + m.get("fname",""))
')
  check "created user logs in, meta intact" "Okonkwo-Chidi" "$NAME"
fi

echo; echo "passed=$pass failed=$fail"; [[ $fail -eq 0 ]]
