# Local setup (Windows + WSL2 + Docker + k3d)

Everything runs inside WSL. Keep the repo in the WSL filesystem (`~/Project/urumi`), not `/mnt/c`.

## Tools

Docker, kubectl, helm, k3d, Node 22 (nvm). WSL needs about 6-8 GB RAM (`.wslconfig`: `memory=8GB`).

## Local domains

`shop.localtest.me` and `app.localtest.me` resolve to 127.0.0.1 through public DNS, so no hosts-file editing is required. k3d publishes ports 80 and 443
of the load balancer, Traefik routes by `Host` header. Fallback: add the names to `/etc/hosts` and the Windows hosts file.

## Cluster

`scripts/cluster-create.sh` creates a k3d cluster with a fixed API port (6550), ports 80/443 and a local registry (`urumi-registry:5000`, pushed to as `localhost:5000`).
Install order: store, mcp-servers, platform (see README).

## Troubleshooting (problems we actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| Port 80 already in use at cluster creation | Another process holds it | `sudo ss -tlnp \| grep ':80 '`, stop it |
| Pods stuck in `ContainerCreating`, `i/o timeout` pulling images | Docker DNS/MTU in WSL | `/etc/docker/daemon.json`: `{"dns":["8.8.8.8","1.1.1.1"],"mtu":1400}`, restart Docker, recreate the cluster |
| `kubectl` times out after a reboot, load balancer restarts repeatedly (`host not found in upstream`) | Docker left `k3d-urumi-serverlb` on no network | `docker stop`, `docker network connect k3d-urumi k3d-urumi-serverlb`, `docker start` (done automatically by `cluster-start.sh`) |
| CoreDNS in `ImagePullBackOff` after reboot | Node DNS | Restart Docker and the cluster; or `docker pull` on the host and `k3d image import` |
| Setup Job stuck at "Waiting for database" | Check needed an installed WordPress | Fixed: `db-check.php` uses a plain MySQL connection |
| WooCommerce plugin refuses to install | Latest plugin requires a newer WordPress | Plugin version is pinned in `values.yaml` |
| `npm ci` "Exit handler never called" in Docker build | Flaky network | Retries in the Dockerfile; `docker build --network=host` |
| `$H` header variable breaks curl in zsh | zsh does not word-split variables | Write headers out or use a function |
| Copy button does nothing on http | Clipboard API needs a secure context | Fallback implemented; works on https |
| New env or Secret not picked up | Pods read env once at start | `kubectl rollout restart` |

## Daily routine

Before shutdown: `./scripts/cluster-stop.sh`. After boot: `./scripts/cluster-start.sh` (starts Docker, the registry and the cluster, repairs the load balancer, restarts CoreDNS if needed).
