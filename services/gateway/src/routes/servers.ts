import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { encrypt } from "../crypto.js";
import { requireAdmin, requireSession } from "../auth/middleware.js";
import { validateUpstreamUrl } from "../mcp/ssrf.js";

const SLUG = /^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$/;       // same rule as the DB CHECK
const HEADER = /^[A-Za-z0-9-]{1,64}$/;
const FORBIDDEN_HEADERS = new Set(["host", "content-length", "content-type", "accept", "transfer-encoding", "connection"]);
const UUID = /^[0-9a-f-]{36}$/;

const createSchema = z.object({
  slug: z.string().regex(SLUG, "slug: 1-24 chars, lowercase letters, digits and single hyphens"),
  name: z.string().min(1).max(80),
  url: z.string().max(500),
  auth_type: z.enum(["none", "bearer", "header"]).default("none"),
  header_name: z.string().regex(HEADER).optional(),
  credential: z.string().min(1).max(2000).optional(),
  enabled: z.boolean().default(true),
});

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  url: z.string().max(500).optional(),
  auth_type: z.enum(["none", "bearer", "header"]).optional(),
  header_name: z.string().regex(HEADER).nullable().optional(),
  // undefined = keep the stored credential, null = remove it, string = replace it
  credential: z.string().min(1).max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
});

// The ONLY shape that leaves the server. credential_enc is never selected into it.
function view(r: any, admin: boolean) {
  const base = {
    id: r.id, slug: r.slug, name: r.name, enabled: r.enabled,
    status: r.enabled ? r.status : "disabled",
    status_reason: r.status_reason, last_checked_at: r.last_checked_at,
  };
  if (!admin) return base; // members see no URLs, auth settings or credentials
  return { ...base, url: r.url, auth_type: r.auth_type, header_name: r.header_name,
           hasCredential: !!r.credential_enc, created_at: r.created_at };
}

function checkAuthConsistency(auth_type: string, header_name: string | null | undefined, hasCred: boolean): string | null {
  if (auth_type === "none") return null;
  if (!hasCred) return `auth_type '${auth_type}' needs a credential`;
  if (auth_type === "header") {
    if (!header_name) return "auth_type 'header' needs header_name";
    if (FORBIDDEN_HEADERS.has(header_name.toLowerCase())) return `header ${header_name} is not allowed`;
  }
  return null;
}

export async function serverRoutes(app: FastifyInstance) {
  app.get("/api/servers", { preHandler: requireSession }, async (req) => {
    const { rows } = await pool.query("SELECT * FROM servers ORDER BY created_at");
    return rows.map((r) => view(r, req.user!.role === "admin"));
  });

  app.post("/api/servers", { preHandler: requireAdmin }, async (req, reply) => {
    const b = createSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    const d = b.data;
    const urlErr = validateUpstreamUrl(d.url);
    if (urlErr) return reply.code(400).send({ error: `url: ${urlErr}` });
    const authErr = checkAuthConsistency(d.auth_type, d.header_name, !!d.credential);
    if (authErr) return reply.code(400).send({ error: authErr });
    try {
      const { rows } = await pool.query(
        `INSERT INTO servers (slug, name, url, auth_type, header_name, credential_enc, enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [d.slug, d.name, d.url, d.auth_type, d.header_name ?? null,
         d.credential ? encrypt(d.credential) : null, d.enabled]);
      return reply.code(201).send(view(rows[0], true));
    } catch (e: any) {
      if (e.code === "23505") return reply.code(409).send({ error: `slug '${d.slug}' already exists` });
      throw e;
    }
  });

  app.patch("/api/servers/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id)) return reply.code(400).send({ error: "bad id" });
    const b = patchSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    const p = b.data;

    const cur = (await pool.query("SELECT * FROM servers WHERE id = $1", [id])).rows[0];
    if (!cur) return reply.code(404).send({ error: "server not found" });

    const url = p.url ?? cur.url;
    const auth_type = p.auth_type ?? cur.auth_type;
    const header_name = p.header_name === undefined ? cur.header_name : p.header_name;
    const credential_enc = p.credential === undefined ? cur.credential_enc
                         : p.credential === null ? null : encrypt(p.credential);
    const enabled = p.enabled ?? cur.enabled;

    const urlErr = validateUpstreamUrl(url);
    if (urlErr) return reply.code(400).send({ error: `url: ${urlErr}` });
    const authErr = checkAuthConsistency(auth_type, header_name, !!credential_enc);
    if (authErr) return reply.code(400).send({ error: authErr });

    // Any change resets status so the health manager (step 4.5) re-checks the server.
    const { rows } = await pool.query(
      `UPDATE servers SET name=$2, url=$3, auth_type=$4, header_name=$5, credential_enc=$6, enabled=$7,
              status='unknown', status_reason=NULL
        WHERE id=$1 RETURNING *`,
      [id, p.name ?? cur.name, url, auth_type, auth_type === "header" ? header_name : null, credential_enc, enabled]);
    return view(rows[0], true);
  });

  app.delete("/api/servers/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id)) return reply.code(400).send({ error: "bad id" });
    const { rowCount } = await pool.query("DELETE FROM servers WHERE id = $1", [id]);
    return rowCount ? { deleted: true } : reply.code(404).send({ error: "server not found" });
  });
}
