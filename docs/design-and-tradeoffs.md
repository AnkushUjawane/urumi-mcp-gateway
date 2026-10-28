# System design and tradeoffs

## Architecture choices

| Choice | Why | Tradeoff |
|---|---|---|
| Three charts, three namespaces | Separate blast radius, and NetworkPolicies can target namespaces | More moving parts than one chart |
| Own small chart for WordPress and MariaDB | Every resource is understood and explainable | No upstream chart maintenance |
| woo-mcp in the `store` namespace | Sits next to its store and Secret | Cross-namespace NetworkPolicy needed for the gateway |
| TypeScript everywhere | The MCP SDK provides both client and server | Single language ecosystem |
| Gateway is stateless except Postgres | Sessions are signed cookies, `/mcp` is stateless, so replicas would be possible | A DB lookup per request |
| Same-origin dashboard and API behind one host | No CORS, simple cookie handling | Ingress path routing must stay correct |

## woo-mcp: how it talks to the store, and why

It calls the **WooCommerce REST API** (`/wp-json/wc/v3`) with a consumer key and secret read from a Kubernetes Secret.

- Stateless, network-only, uses a scoped and revocable key, needs no extra privileges.
- WP-CLI would need `kubectl exec` rights into the WordPress pod (Kubernetes API access for an MCP server) and is slow.
- Direct SQL would bypass WooCommerce business logic (stock, totals, hooks) and give the server full DB access.

Details: calls go to `http://wordpress` inside the cluster, so the client sends `Host: <public host>` (WordPress redirects otherwise)
and `X-Forwarded-Proto: https` (WooCommerce accepts REST keys only over HTTPS; wp-config trusts that header). Redirects are never followed.
Every call has a 10 s timeout. Tool output is trimmed to a few fields to save the model's context.

## Tool aggregation, routing and failure handling

- **Naming:** every tool is exposed as `{slug}__{tool}` (`woo__list_orders`, `notes__ping`, `utils__ping`). Slugs are 1-24 chars of `[a-z0-9-]`
  (DB CHECK and API regex), so a slug can never contain `__`, and the gateway splits on the first `__`. This resolves collisions.
  Descriptions are prefixed `[slug]` and capped at 500 characters.
- **Listing reads a cache.** A background loop (every 30 s, and after any server change) refreshes each enabled server in parallel with a 3 s timeout
  (`Promise.allSettled`). `tools/list` never waits on an upstream. Unreachable servers contribute no tools.
- **Status and reason:** Connected, Unreachable (timeout, connection refused, DNS lookup failed, auth failed 401/403, protocol error) or Disabled.
- **Calls:** `callToolAs(user, source, name, args)` checks the permission rule, finds the server, requires it enabled and advertising that tool,
  calls with a 15 s hard deadline, and returns an `isError` result with a clear message on failure. A connection-type failure marks the server
  unreachable immediately, so its tools vanish without waiting for the next refresh. A timeout does not cancel work already started upstream.
- **One code path:** `/mcp`, `/api/tools/call` and the chat agent all use `callToolAs`, so permissions, timeouts and the audit row are identical.
- **Audit:** one row per call in a `finally` block (user, server, tool, time, duration, outcome). Arguments and results are not stored.
- **Credentials:** the upstream gets its own static credential (decrypted in memory at call time). The caller's key is never forwarded.
- **Upstream clients are short-lived** (one per operation). Upstreams are stateless, so no reconnect logic is needed.

## Auth and access

- Dashboard: email and password (scrypt), signed httpOnly session cookie, user row re-read on every request (disabling takes effect at once),
  Origin check on cookie-authenticated writes.
- MCP clients: `Authorization: Bearer gw_...`. Only the SHA-256 and a prefix are stored. Revocation is checked on every request.
- Invites: random token, only its hash stored, 48 h expiry, single use enforced by one atomic `UPDATE ... WHERE used_at IS NULL`.
- Roles: admin (servers, members, rules) and member (use tools, own keys, own audit rows). Enforced in the gateway queries and middleware, not only in the UI.
- Tool permissions: deny rules per role in Postgres. Denied tools are hidden from `/mcp`, `/api/tools` and the chat model, and rejected (and audited as `denied`) if called. Admins are never restricted.

## Chat agent

Runs inside the gateway: it sends the user's visible tools to an OpenAI-compatible LLM endpoint, executes returned tool calls with
`callToolAs(user, "chat", ...)`, and repeats (max 8 rounds). Events stream to the browser as server-sent events. The provider is pinned for
the whole run (switching providers mid-conversation caused a 400 because tool-call formats differ). If the first provider fails
(timeout, 429, 5xx, 404) at the start, the next is tried. Keys are in the `llm-secrets` Secret, created by a script and not by Helm.
The browser owns the history; the gateway stores no conversations. Two Groq/Gemini free-tier facts shaped this design: models can be retired or
overloaded, and per-minute token limits are small, so the model names are Helm values and replies are capped.

## What changes for production

| Concern | Local | VPS |
|---|---|---|
| DNS and Ingress hosts | `*.localtest.me`, Traefik | Real subdomains, TLS via cert-manager |
| Scheme and cookies | http, `COOKIE_SECURE=false` | https, `COOKIE_SECURE=true`, WordPress `WP_HOME` https |
| Storage | k3d `local-path` | `local-path` on the VPS (or a cloud class) |
| Secrets | Generated by the charts (`randAlphaNum` + `lookup`) | Created by hand and referenced by `existingSecret` |
| Images | `urumi-registry:5000` | A registry the VPS can pull |

See `docs/vps-deployment.md`.

## Tradeoffs we accepted

- Notes are in memory (lost on pod restart), which makes the "kill a pod" demo visible.
- Ingress-only NetworkPolicies, and a basic URL check for servers: stated as limitations, not hidden.
- A failed pinned provider mid-run ends the run instead of switching providers.
