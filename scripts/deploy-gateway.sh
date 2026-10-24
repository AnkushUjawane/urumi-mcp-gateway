#!/usr/bin/env bash
# Build the gateway, push it with a unique tag, and roll it out.
set -e
TAG=${1:-dev-$(date +%s)}
docker build -t localhost:5000/gateway:$TAG services/gateway
docker push localhost:5000/gateway:$TAG
helm upgrade --install platform charts/platform -n platform \
  -f charts/platform/values-local.yaml --set gateway.image.tag=$TAG --wait --timeout 5m
kubectl get pods -n platform
