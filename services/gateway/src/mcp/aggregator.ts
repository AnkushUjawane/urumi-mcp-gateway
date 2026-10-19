import { getAllEntries } from "./manager.js";

export const SEP = "__";
export type AggTool = { name: string; description: string; inputSchema: any; server: string };

// Many MCP clients only accept tool names matching [a-zA-Z0-9_-] and at most 64 characters.
const CLIENT_SAFE = /^[a-zA-Z0-9_-]{1,64}$/;

// Reads the CACHE only: never waits on an upstream. Unreachable servers have no cached tools,
// so they simply do not appear.
export function listAggregatedTools(): AggTool[] {
  const out: AggTool[] = [];
  for (const [slug, entry] of getAllEntries()) {
    for (const t of entry.tools) {
      const name = `${slug}${SEP}${t.name}`;
      if (!CLIENT_SAFE.test(name)) {
        console.warn(`skipping tool '${name}': name not usable by MCP clients`);
        continue;
      }
      out.push({ name, description: `[${slug}] ${t.description}`, inputSchema: t.inputSchema, server: slug });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Split on the FIRST "__" only. Slugs can never contain "__" (DB CHECK + API regex),
// so the first separator always ends the slug, even if the upstream tool name has "__" in it.
export function splitToolName(full: string): { slug: string; tool: string } | null {
  const i = full.indexOf(SEP);
  if (i <= 0 || i + SEP.length >= full.length) return null;
  return { slug: full.slice(0, i), tool: full.slice(i + SEP.length) };
}
