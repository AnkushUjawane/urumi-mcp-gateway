#!/usr/bin/env bash
# Checks the running cluster end to end as the admin. Creates and revokes its own temporary API key.
set -u
HOST=app.localtest.me
BASE=http://localhost
pass=0; fail=0
ok()    { echo "PASS  $1"; pass=$((pass+1)); }
bad()   { echo "FAIL  $1"; fail=$((fail+1)); }
check() { [ "$2" = "$3" ] && ok "$1" || bad "$1 (got '$2', want '$3')"; }

jar=$(mktemp)
req()  { curl -s -H "Host: $HOST" -H 'Content-Type: application/json' "$@"; }
code() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" -H 'Content-Type: application/json' "$@"; }
dcode() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST" "$@"; }
mcp()  { curl -s -H "Host: $HOST" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' "$@"; }

PW=$(kubectl get secret platform-secrets -n platform -o jsonpath='{.data.admin-password}' | base64 -d)

check "admin login" "$(code -c "$jar" $BASE/api/auth/login -d "{\"email\":\"admin@example.com\",\"password\":\"$PW\"}")" 200
check "no session -> 401" "$(code $BASE/api/servers)" 401
check "3 servers connected" "$(req -b "$jar" $BASE/api/servers | grep -o '"status":"connected"' | wc -l | tr -d ' ')" 3
check "no credential in servers API" "$(req -b "$jar" $BASE/api/servers | grep -c 'bearer-token\|"credential"')" 0

KEYJSON=$(req -b "$jar" $BASE/api/keys -d '{"name":"smoke-test"}')
KEY=$(echo "$KEYJSON" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
KID=$(echo "$KEYJSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$KEY" ] && ok "API key created" || bad "API key created"

LIST=$(mcp $BASE/mcp -H "Authorization: Bearer $KEY" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
check "11 prefixed tools via /mcp" "$(echo "$LIST" | grep -o '"name":"[a-z]*__[a-z_]*"' | wc -l | tr -d ' ')" 11
check "notes__ping present" "$(echo "$LIST" | grep -c 'notes__ping')" 1
check "utils__ping present" "$(echo "$LIST" | grep -c 'utils__ping')" 1

CALC=$(mcp $BASE/mcp -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"utils__calculate","arguments":{"expression":"6*7"}}}')
echo "$CALC" | grep -q '42' && ok "tool call through gateway (6*7=42)" || bad "tool call through gateway"

ORD=$(mcp $BASE/mcp -H "Authorization: Bearer $KEY" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"woo__list_orders","arguments":{"limit":1}}}')
echo "$ORD" | grep -q '"isError":false\|"result"' && ok "woo__list_orders reachable" || bad "woo__list_orders reachable"

check "wrong key -> 401" "$(code -X POST $BASE/mcp -H 'Accept: application/json, text/event-stream' -H 'Authorization: Bearer gw_nope' -d '{}')" 401
check "revoke key" "$(dcode -b "$jar" -X DELETE $BASE/api/keys/$KID)" 200
check "revoked key -> 401" "$(code -X POST $BASE/mcp -H 'Accept: application/json, text/event-stream' -H "Authorization: Bearer $KEY" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')" 401
req -b "$jar" "$BASE/api/audit?status=denied&limit=5" | grep -q 'API key revoked' && ok "revoked attempt in audit log" || bad "revoked attempt in audit log"
req -b "$jar" "$BASE/api/audit?limit=20" | grep -q '"source":"mcp"' && ok "mcp calls audited" || bad "mcp calls audited"

check "chat status enabled" "$(req -b "$jar" $BASE/api/chat/status | grep -c '"enabled":true')" 1
check "chat without login -> 401" "$(code $BASE/api/chat -d '{"messages":[{"role":"user","content":"hi"}]}')" 401

rm -f "$jar"
echo; echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
