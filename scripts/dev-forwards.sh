#!/usr/bin/env bash
# Restarts all local port-forwards used by the gateway dev setup.
pkill -f "kubectl port-forward" 2>/dev/null; sleep 1
kubectl port-forward -n platform pod/postgres-0 5432:5432 >/dev/null 2>&1 &
kubectl port-forward -n store svc/woo-mcp 13000:3000 >/dev/null 2>&1 &
kubectl port-forward -n mcp svc/notes-mcp 13001:3000 >/dev/null 2>&1 &
kubectl port-forward -n mcp svc/utils-mcp 13002:3000 >/dev/null 2>&1 &
sleep 2; ss -tlnp 2>/dev/null | grep -E ':5432 |:1300[012] '
