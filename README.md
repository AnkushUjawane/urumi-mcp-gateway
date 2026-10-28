# Urumi MCP Gateway: WooCommerce hosting with a team MCP gateway on Kubernetes

A WooCommerce store, a hand-written WooCommerce MCP server, a team MCP gateway with a React
dashboard, and a chat agent. Everything runs on Kubernetes and is installed with Helm.

Repo: https://github.com/AnkushUjawane/urumi-mcp-gateway

## Architecture

    Browser ── Traefik ──┬─ shop.localtest.me ──► WordPress ► MariaDB            (ns: store)
                         └─ app.localtest.me  ──┬─ /      ► dashboard (nginx)    (ns: platform)
                                                ├─ /api   ► gateway ► Postgres
                                                └─ /mcp   ► gateway
    Claude Code / Inspector ── /mcp + API key ──► gateway ──┬─► woo-mcp ► WordPress   (ns: store)
    Chat agent (inside gateway) ───────────────────────────┬─► notes-mcp             (ns: mcp)
                                                           └─► utils-mcp             (ns: mcp)

Public (Ingress): storefront, dashboard, gateway `/api` and `/mcp`.
Internal only (ClusterIP + NetworkPolicy): woo-mcp, notes-mcp, utils-mcp, MariaDB, Postgres.

| Chart | Namespace | Contents |
|---|---|---|
| `charts/store` | store | WordPress, MariaDB, setup Job (WP-CLI), woo-mcp, NetworkPolicies |
| `charts/mcp-servers` | mcp | notes-mcp, utils-mcp, NetworkPolicies |
| `charts/platform` | platform | Postgres, gateway, dashboard, Ingress, NetworkPolicies |

Code: `services/woo-mcp`, `services/notes-mcp`, `services/utils-mcp`, `services/gateway`, `dashboard/`.
Docs: `docs/` (design, threat model, local setup, VPS, demo script).

## Local setup (WSL2 + Docker, k3d)

Prerequisites: Docker, kubectl, helm, k3d, Node 22. Details and troubleshooting: `docs/local-setup.md`.

    ./scripts/cluster-create.sh        # k3d cluster, Traefik, local registry on :5000
    ./scripts/build-push.sh            # builds and pushes woo-mcp, notes-mcp, utils-mcp, gateway
    helm upgrade --install store charts/store -n store --create-namespace \
      -f charts/store/values-local.yaml --wait --timeout 25m
    helm upgrade --install mcp-servers charts/mcp-servers -n mcp --create-namespace \
      -f charts/mcp-servers/values-local.yaml --wait --timeout 5m
    helm upgrade --install platform charts/platform -n platform --create-namespace \
      -f charts/platform/values-local.yaml --wait --timeout 5m
    ./scripts/deploy-dashboard.sh      # builds the dashboard image and rolls it out
    ./scripts/set-llm-keys.sh          # paste Gemini and/or Groq keys (hidden input)
    kubectl rollout restart deploy/gateway -n platform

After a reboot: `./scripts/cluster-start.sh`. Before shutdown: `./scripts/cluster-stop.sh`.

### URLs (local domain approach)

`*.localtest.me` resolves to 127.0.0.1 in public DNS, so no hosts-file edit is normally needed:

- Storefront: http://shop.localtest.me
- Dashboard and gateway: http://app.localtest.me (MCP endpoint: http://app.localtest.me/mcp)

If the name does not resolve, add `127.0.0.1 shop.localtest.me app.localtest.me` to
`/etc/hosts` (and `C:\Windows\System32\drivers\etc\hosts` for a Windows browser).

### First login and registering servers

Admin: `admin@example.com`, password:

    kubectl get secret platform-secrets -n platform -o jsonpath='{.data.admin-password}' | base64 -d; echo

`woo` is registered automatically on first start. Register the other two in the dashboard
(Servers, Add server):

| Slug | URL | Auth |
|---|---|---|
| notes | `http://notes-mcp.mcp.svc.cluster.local:3000/mcp` | Bearer, token from `kubectl get secret mcp-server-tokens -n mcp -o jsonpath='{.data.notes-token}' \| base64 -d` |
| utils | `http://utils-mcp.mcp.svc.cluster.local:3000/mcp` | None |

## How to use it

**Place an order:** open the storefront, add a product, check out with Cash on delivery.
The order appears in wp-admin (`http://shop.localtest.me/wp-admin`, user `admin`, password from
`kubectl get secret store-secrets -n store -o jsonpath='{.data.wp-admin-password}' | base64 -d`).

**Invite a member:** Members, enter an email, copy the one-time link (there is no mail server),
open it in a private window, set a password.

**Connect an external MCP client** (as the member): API keys, Create key, copy it (shown once), then

    claude mcp add --transport http urumi http://app.localtest.me/mcp --header "Authorization: Bearer gw_..."

or with MCP Inspector:

    npx @modelcontextprotocol/inspector --cli --server-url http://app.localtest.me/mcp \
      --transport http --header "Authorization: Bearer gw_..." --method tools/list

**Use the chat agent:** open Chat in the dashboard, for example "What orders came in today?".
Each tool call appears as a card. Calls are made as you and show in the Audit log with source `chat`.
Free LLM tiers are rate limited: wait about a minute between runs.

## Tests

    ./scripts/smoke-test.sh    # 17 end-to-end checks against the running cluster

## Production / VPS

`docs/vps-deployment.md`. The same charts are used with `values-prod.yaml`.

## Stand-out items attempted

| Item | Where |
|---|---|
| Tool permissions (per-role deny rules, hidden from lists and rejected on call) | `services/gateway/src/mcp/permissions.ts`, `routes/toolRules.ts`, `migrations/003_tool_rules.sql` |
| Security hardening (partial): default-deny NetworkPolicies, non-root and read-only containers, credentials encrypted at rest, URL check for new servers | `charts/*/templates/networkpolicies.yaml`, `services/gateway/src/crypto.ts`, `mcp/ssrf.ts` |
| Upgrades and rollback with Helm | `docs/vps-deployment.md` |
| Production values for a VPS (prepared, see status there) | `charts/*/values-prod.yaml`, `docs/vps-deployment.md` |

Not attempted: multi-store provisioning, OAuth, many-tools handling, hosted servers, scaling, observability.

## Known limitations

- No email server: invite links are copied by an admin. No password reset.
- Tool permissions are managed through the API (`/api/tool-rules`), not the dashboard.
- NetworkPolicies cover ingress only; there are no egress policies.
- The URL check for new servers does not resolve DNS (see the threat model).
- Product links in tool results start with `https://` because woo-mcp sends `X-Forwarded-Proto: https`.
- Chat history lives only in the browser tab.
