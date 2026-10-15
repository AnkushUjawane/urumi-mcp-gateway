#!/usr/bin/env bash
set -e
k3d cluster create urumi --servers 1 --agents 1 \
  --api-port 6550 \
  -p "80:80@loadbalancer" -p "443:443@loadbalancer" \
  --registry-create urumi-registry:0.0.0.0:5000
kubectl wait --for=condition=Ready node --all --timeout=180s
kubectl get pods -A
