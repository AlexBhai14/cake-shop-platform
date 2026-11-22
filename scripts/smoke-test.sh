#!/usr/bin/env bash
# Quick health check of a deployed system (used by the pipeline after a deployment).
# It opens a port-forward to the gateway and checks a few URLs. Exit code 1 = something is wrong.
set -uo pipefail

NAMESPACE="${NAMESPACE:-cake-shop}"
PORT="${SMOKE_PORT:-3900}"

kubectl port-forward -n "$NAMESPACE" svc/api-gateway "$PORT:3000" > /dev/null 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT

code() { curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$1" || echo "000"; }

echo "Waiting for the gateway ..."
for i in $(seq 1 30); do
  [ "$(code "http://localhost:$PORT/health")" = "200" ] && break
  sleep 2
done

fail=0
check() { # name url expected-status
  actual="$(code "$2")"
  if [ "$actual" = "$3" ]; then echo "OK    $1 ($actual)"; else echo "FAIL  $1: expected $3, got $actual"; fail=1; fi
}

check "gateway liveness"            "http://localhost:$PORT/health"        200
check "gateway readiness (Redis)"   "http://localhost:$PORT/health/ready"  200
check "public product list"         "http://localhost:$PORT/api/cakes"     200
check "public categories"           "http://localhost:$PORT/api/categories" 200
check "cart needs a login (401)"    "http://localhost:$PORT/api/cart"      401
check "unknown route is a 404"      "http://localhost:$PORT/api/nothing"   404

if [ "$fail" -ne 0 ]; then echo "Smoke test FAILED"; exit 1; fi
echo "Smoke test passed"
