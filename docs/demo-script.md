# Demo script (about 10-12 minutes)

Prep: ./scripts/cluster-start.sh, then ./scripts/smoke-test.sh (all PASS). Users: A = admin, B = member.
Wait ~1 minute between chat runs (Groq free tier: 8K tokens/minute).

1. Architecture (1 min): namespaces store / mcp / platform, one diagram.
2. Store (1 min): order on the storefront, visible in wp-admin.
3. Chat as A (2 min): create product, buy it by hand, ask for today's orders. Show the tool cards.
4. External client as B (2 min): one URL + one key, 11 tools, same orders question, one two-server prompt.
5. Control (2 min): revoke B, disable utils, kill the notes pod, show the badges.
6. Audit log (1 min): every call attributed to A or B.
7. Kubernetes (2 min): kubectl get all/pvc/ingress, probes, limits, Secrets.
8. Security + VPS + upgrade/rollback: see Phase 7 to 9 notes.
