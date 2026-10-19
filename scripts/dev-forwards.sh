#!/usr/bin/env bash
# Port-forwards the locally running gateway needs. Stop with: pkill -f "kubectl port-forward"
pkill -f "kubectl port-forward" 2>/dev/null; sleep 1
kubectl port-forward -n platform pod/postgres-0 5432:5432 >/dev/null 2>&1 &
kubectl port-forward -n store svc/woo-mcp 13000:3000 >/dev/null 2>&1 &
kubectl port-forward -n mcp svc/notes-mcp 13001:3000 >/dev/null 2>&1 &
kubectl port-forward -n mcp svc/utils-mcp 13002:3000 >/dev/null 2>&1 &
sleep 2
ss -tln | grep -E ':(5432|13000|13001|13002) ' || echo "some forwards failed to start"
