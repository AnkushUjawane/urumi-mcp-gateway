#!/usr/bin/env bash
# Usage: source scripts/dev-env.sh
# Loads gateway dev settings from the cluster Secrets into THIS shell.
PGPASS=$(kubectl get secret platform-secrets -n platform -o jsonpath='{.data.postgres-password}' | base64 -d)
export DATABASE_URL="postgres://gateway:${PGPASS}@localhost:5432/gateway"
export ENCRYPTION_KEY=$(kubectl get secret platform-secrets -n platform -o jsonpath='{.data.encryption-key}' | base64 -d)
export SESSION_SECRET=$(kubectl get secret platform-secrets -n platform -o jsonpath='{.data.session-secret}' | base64 -d)
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=$(kubectl get secret platform-secrets -n platform -o jsonpath='{.data.admin-password}' | base64 -d)
export SEED_WOO_URL=http://woo-mcp.store.svc.cluster.local:3000/mcp
echo "gateway dev env loaded"
