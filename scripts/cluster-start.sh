#!/usr/bin/env bash
# Run after boot. Starts Docker + cluster and repairs the known load-balancer problem.
set -u
sudo systemctl start docker 2>/dev/null || sudo service docker start
until docker info >/dev/null 2>&1; do sleep 1; done
docker start urumi-registry 2>/dev/null || true
k3d cluster start urumi

# self-heal: after a reboot Docker sometimes leaves the load balancer on no network
NETS=$(docker inspect k3d-urumi-serverlb --format '{{len .NetworkSettings.Networks}}')
if [ "$NETS" = "0" ]; then
  echo "Load balancer has no network, reattaching..."
  docker stop k3d-urumi-serverlb >/dev/null
  docker network connect k3d-urumi k3d-urumi-serverlb
  docker start k3d-urumi-serverlb >/dev/null
fi

echo "Waiting for API (up to 3 min)..."
for i in $(seq 1 60); do
  kubectl get nodes >/dev/null 2>&1 && break
  sleep 3
done
kubectl wait --for=condition=Ready node --all --timeout=180s

if ! kubectl -n kube-system wait --for=condition=Ready pod -l k8s-app=kube-dns --timeout=60s; then
  kubectl -n kube-system delete pod -l k8s-app=kube-dns
  kubectl -n kube-system wait --for=condition=Ready pod -l k8s-app=kube-dns --timeout=120s
fi
kubectl get pods -A
