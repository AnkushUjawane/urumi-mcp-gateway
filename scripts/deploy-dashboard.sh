#!/usr/bin/env bash
# Build the dashboard, push with a unique tag, and roll it out.
set -e
TAG=${1:-dev-$(date +%s)}
docker build --network=host -t localhost:5000/dashboard:$TAG dashboard
docker push localhost:5000/dashboard:$TAG
helm upgrade --install platform charts/platform -n platform \
  -f charts/platform/values-local.yaml --set dashboard.image.tag=$TAG --wait --timeout 5m
kubectl get pods -n platform
