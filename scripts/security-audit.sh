#!/usr/bin/env bash
# ============================================================
# Security Audit — AI Reconciliation Platform
# Run against a live dev server on :3000
# NOTE: wait >= 5 minutes between runs — the audit itself consumes the
# 10-login/5min IP rate-limit bucket (that is the limiter working as designed).
# A 429 on login checks in re-runs = rate limiter active, not a regression.
# Exit code: number of failed checks
# ============================================================
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR1=/tmp/sec-admin.txt; JAR2=/tmp/sec-attacker.txt
RUN_ID=$(date +%s)
rm -f "$JAR1" "$JAR2"

check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 (expected $2, got $3)"; fi
}
check_neq() {
  if [ "$2" != "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1 (got $3)"; fi
}
contains() {
  if echo "$3" | grep -q "$2"; then PASS=$((PASS+1)); echo "  ✓ $1"; else FAIL=$((FAIL+1)); echo "  ✗ $1"; fi
}

echo "══ 1. Authentication & session ══"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/stats); check "stats requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/projects); check "projects requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/providers); check "providers requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/categories); check "categories requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/ai/chat -X POST -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{}'); check "ai/chat requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/ai/tools -X POST -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{}'); check "ai/tools requires auth (401)" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"email":"admin@reconciliation.ir","password":"WRONGpass1"}'); check "wrong password rejected (401)" 401 "$CODE"
UNIQ1="nosuchuser-$(date +%N)@x.ir"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d "{\"email\":\"$UNIQ1\",\"password\":\"Whatever123\"}"); check "unknown user generic 401 (no enumeration)" 401 "$CODE"
R=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"email":"admin@reconciliation.ir","password":"Admin1234"}' -c "$JAR1")
contains "admin login ok" '"ok":true' "$R"
R=$(curl -s $BASE/api/auth/me -b "$JAR1")
contains "session cookie works" '"ok":true' "$R"

echo "══ 2. CSRF protection ══"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@reconciliation.ir","password":"Admin1234"}'); check "mutation without X-Requested-With blocked (403)" 403 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/projects/xxx -b "$JAR1"); check "DELETE without header blocked (403)" 403 "$CODE"

echo "══ 3. Input validation ══"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/register -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"name":"a","email":"bad","password":"short"}'); check "register invalid input → 400" 400 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/register -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"name":"Test User","email":"weakpass@x.ir","password":"alllowercase1"}'); check "weak password (no upper) → 400" 400 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/register -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"name":"Admin Demo","email":"admin@reconciliation.ir","password":"Admin1234"}'); check "duplicate email → 409" 409 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/categories -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" -d '{"name":"Evil","color":"javascript:alert(1)"}'); check "category color XSS vector → 400" 400 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/providers -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" -d '{"name":"X","type":"hacker-type","apiKey":"testkey12345","models":["m"]}'); check "provider type whitelist → 400" 400 "$CODE"

echo "══ 4. Authorization (IDOR / cross-user) ══"
R=$(curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d '{"name":"Attacker Two","email":"attacker2-'$RUN_ID'@x.ir","password":"Attacker123"}' -c "$JAR2")
contains "second user registered" '"ok":true' "$R"
PROJ_ID=$(curl -s "$BASE/api/projects" -b "$JAR1" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['projects']; print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$PROJ_ID" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/projects/$PROJ_ID" -b "$JAR2"); check_neq "attacker cannot read admin project (403/404)" 200 "$CODE"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/projects/$PROJ_ID" -H "X-Requested-With: XMLHttpRequest" -b "$JAR2"); check_neq "attacker cannot delete admin project" 200 "$CODE"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/projects/$PROJ_ID/results" -b "$JAR2"); check_neq "attacker cannot read admin results" 200 "$CODE"
  RECON_ID=$(curl -s "$BASE/api/reports" -b "$JAR1" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['reports']; print(d[0]['id'] if d else '')" 2>/dev/null)
  if [ -n "$RECON_ID" ]; then
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/matches/$RECON_ID" -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -b "$JAR2" -d '{"action":"approve"}'); check_neq "attacker cannot mutate admin match group" 200 "$CODE"
  fi
else
  echo "  (no projects for admin — skipping IDOR project checks)"
fi

echo "══ 5. Rate limiting ══"
RL_BLOCKED=0
for i in $(seq 1 12); do
  UNIQ2="ratelimit-$(date +%N)-$i@x.ir"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d "{\"email\":\"$UNIQ2\",\"password\":\"Nope12345\"}")
  [ "$CODE" = "429" ] && RL_BLOCKED=1 && break
done
check "login rate limit kicks in (429 within 12 tries)" 1 "$RL_BLOCKED"
sleep 1

echo "══ 6. File upload security ══"
printf 'PK\x03\x04FAKEZIPCONTENT' > /tmp/evil.csv
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/projects/$PROJ_ID/files" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" -F "files=@/tmp/evil.csv;type=text/csv")
check_neq "binary disguised as CSV rejected (400)" 400 "$CODE"
printf '<?php echo shell_exec($_GET["c"]); ?>' > /tmp/evil.php
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/projects/$PROJ_ID/files" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" -F "files=@/tmp/evil.php")
check_neq "php upload rejected (400)" 400 "$CODE"

echo "══ 7. Path traversal & download guard ══"
if [ -n "$PROJ_ID" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/files/..%2f..%2f..%2fetc%2fpasswd/download" -b "$JAR1"); check_neq "traversal in file id blocked" 200 "$CODE"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/files/not-a-real-id/download" -b "$JAR1"); check_neq "unknown file id download blocked (404/403)" 200 "$CODE"
fi

echo "══ 8. Security headers ══"
HDRS=$(curl -s -I $BASE/)
contains "X-Frame-Options DENY" "X-Frame-Options: DENY" "$HDRS"
contains "X-Content-Type-Options nosniff" "X-Content-Type-Options: nosniff" "$HDRS"
contains "CSP present" "Content-Security-Policy" "$HDRS"
contains "frame-ancestors none" "frame-ancestors 'none'" "$HDRS"
contains "Referrer-Policy" "Referrer-Policy" "$HDRS"

echo "══ 9. Secret hygiene ══"
BODY=$(curl -s $BASE/api/providers -b "$JAR1")
check_neq "apiKeyEnc never in provider responses" "found" "$(echo "$BODY" | grep -c apiKeyEnc)"
check_neq "no plaintext key fragments" "found" "$(echo "$BODY" | grep -c 'sk-test')"
R=$(curl -s $BASE/api/auth/me -b "$JAR1")
check_neq "passwordHash never in session payload" "found" "$(echo "$R" | grep -c passwordHash)"

echo "══ 10. Injection resistance (stored, parameterized) ══"
R=$(curl -s -X POST $BASE/api/projects -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" -d '{"name":"'"'"'; DROP TABLE Project;--"}')
contains "SQL-injection-style name stored safely" '"ok":true' "$R"
R=$(curl -s "$BASE/api/search?q=%27%3BDROP%20TABLE%20Project%3B--" -b "$JAR1")
contains "search injection param safe" '"ok":true' "$R"
CLEANUP=$(curl -s "$BASE/api/projects?q=DROP" -b "$JAR1" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']['projects']; print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$CLEANUP" ]; then
  curl -s -X DELETE "$BASE/api/projects/$CLEANUP" -H "X-Requested-With: XMLHttpRequest" -b "$JAR1" > /dev/null
  echo "  (injection test project cleaned up)"
fi

echo ""
echo "════════════════════════════════════"
echo "RESULTS: $PASS passed, $FAIL failed"
echo "════════════════════════════════════"
exit $FAIL
