#!/usr/bin/env bash
# Build the dashboard, push with a unique tag, roll it out. Keeps the gateway's current tag.
set -e
TAG=${1:-dev-$(date +%s)}
GTAG=$(kubectl get deploy gateway -n platform -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | cut -d: -f3)
GTAG=${GTAG:-0.1.0}
echo "dashboard=$TAG gateway=$GTAG (kept)"
docker build --network=host -t localhost:5000/dashboard:$TAG dashboard
docker push localhost:5000/dashboard:$TAG
helm upgrade --install platform charts/platform -n platform \
  -f charts/platform/values-local.yaml \
  --set dashboard.image.tag=$TAG --set gateway.image.tag=$GTAG \
  --wait --timeout 5m
kubectl get pods -n platform
