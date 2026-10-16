#!/usr/bin/env bash
# Rebuild the whole system from scratch.
set -e
./scripts/cluster-create.sh
./scripts/build-push.sh
helm upgrade --install store charts/store -n store --create-namespace \
  -f charts/store/values-local.yaml --wait --timeout 25m
helm upgrade --install mcp-servers charts/mcp-servers -n mcp --create-namespace \
  -f charts/mcp-servers/values-local.yaml --wait --timeout 5m
helm upgrade --install platform charts/platform -n platform --create-namespace \
  -f charts/platform/values-local.yaml --wait --timeout 5m
helm upgrade --install platform charts/platform -n platform --create-namespace \
  -f charts/platform/values-local.yaml --wait --timeout 5m
