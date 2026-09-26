#!/bin/bash
# Task 2 HTTP smoke test — real network via `php artisan serve` + curl.
export PATH=/opt/data/bin:/opt/data/opt:$PATH
cd /opt/data/projects/nikahyuk || exit 1

# Reset rate-limiter counters so this run never inherits state from a previous one.
php artisan cache:clear >/dev/null 2>&1 || true

BASE=http://127.0.0.1:8010
SCRATCH=/opt/data/cache/scratch
TOKEN=$(python3 -c "import json;print(json.load(open('$SCRATCH/task2_fixtures.json'))['token_a'])")

PASS=0; FAIL=0
ck() { # label expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS  $1";
  else FAIL=$((FAIL+1)); echo "  FAIL  $1   (expected [$2], got [$3])"; fi
}
jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

nohup php artisan serve --host=127.0.0.1 --port=8010 > "$SCRATCH/serve.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT

echo "== waiting for server =="
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/invitations/andi-sari")
  [ "$code" = "200" ] && break
  sleep 0.25
done
ck "server up: GET public slug -> 200" 200 "$code"

echo "== public GET by slug =="
body=$(curl -s "$BASE/api/invitations/andi-sari")
ck "guest_count == 2" 2 "$(echo "$body" | jget "['data']['guest_count']")"
ck "groom name" "Andi Pratama" "$(echo "$body" | jget "['data']['bride_data']['groom']['name']")"

echo "== public guest POST =="
out=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/invitations/andi-sari/guests" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"name":"Tamu Smoke","rsvp_status":"attending","message":"Datang ya!"}')
code=$(echo "$out" | tail -n1); body=$(echo "$out" | head -n -1)
ck "guest POST -> 201" 201 "$code"
ck "guest name roundtrip" "Tamu Smoke" "$(echo "$body" | jget "['data']['name']")"
ck "guest rsvp_status" "attending" "$(echo "$body" | jget "['data']['rsvp_status']")"

body=$(curl -s "$BASE/api/invitations/andi-sari")
ok=$(echo "$body" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print((d['guest_count']==3) and ('Tamu Smoke' in [g['name'] for g in d['guests']]))")
ck "guest_count 3 and Tamu Smoke listed" "True" "$ok"

echo "== guarded endpoints over HTTP =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/invitations" \
  -H 'Accept: application/json' -H 'Content-Type: application/json' -d '{}')
ck "create without token -> 401" 401 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/invitations/andi-sari-2")
ck "draft slug public -> 404" 404 "$code"

echo "== authed create via HTTP (Bearer token) =="
out=$(curl -s -w '\n%{http_code}' -X POST "$BASE/api/invitations" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"template_name":"minimalis","bride_data":{"groom":{"name":"Smoke Groom"},"bride":{"name":"Smoke Bride"}}}')
code=$(echo "$out" | tail -n1); body=$(echo "$out" | head -n -1)
ck "authed create -> 201" 201 "$code"
ck "slug generated" "smoke-groom-smoke-bride" "$(echo "$body" | jget "['data']['slug']")"
ck "status draft" "draft" "$(echo "$body" | jget "['data']['status']")"

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/user" -H "Authorization: Bearer $TOKEN")
ck "GET /api/user -> 200" 200 "$code"

echo ""
echo "== SMOKE SUMMARY: $PASS passed, $FAIL failed =="
[ "$FAIL" = "0" ] || exit 1
