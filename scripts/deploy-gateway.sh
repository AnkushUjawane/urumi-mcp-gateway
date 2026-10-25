#!/usr/bin/env bash
# Build the gateway, push with a unique tag, roll it out. Keeps the dashboard's current tag.
set -e
TAG=${1:-dev-$(date +%s)}
DTAG=$(kubectl get deploy dashboard -n platform -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null | cut -d: -f3)
DTAG=${DTAG:-0.1.0}
echo "gateway=$TAG dashboard=$DTAG (kept)"
docker build --network=host -t localhost:5000/gateway:$TAG services/gateway
docker push localhost:5000/gateway:$TAG
helm upgrade --install platform charts/platform -n platform \
  -f charts/platform/values-local.yaml \
  --set gateway.image.tag=$TAG --set dashboard.image.tag=$DTAG \
  --wait --timeout 5m
kubectl get pods -n platform
