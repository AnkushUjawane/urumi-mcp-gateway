import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// In-memory store. Lives in the process: a pod restart empties it.
// This is a deliberate tradeoff (documented in the design note).
type Note = { id: number; title: string; body: string; created_at: string };
const notes: Note[] = [];
let nextId = 1;
const MAX_NOTES = 500;

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});
const fail = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });

export function registerTools(server: McpServer) {
  server.registerTool("ping", {
    description: "Health check for the notes server. Returns 'pong' with the server name and note count.",
    inputSchema: {},
  }, () => ok({ reply: "pong", server: "notes-mcp", notes: notes.length }));

  server.registerTool("save_note", {
    description: "Save a short note with a title and body. Returns the saved note with its id.",
    inputSchema: {
      title: z.string().min(1).max(120).describe("Short title"),
      body: z.string().min(1).max(4000).describe("Note text"),
    },
  }, ({ title, body }) => {
    if (notes.length >= MAX_NOTES) return fail(`Note limit reached (${MAX_NOTES}).`);
    const note: Note = { id: nextId++, title, body, created_at: new Date().toISOString() };
    notes.push(note);
    return ok(note);
  });

  server.registerTool("list_notes", {
    description: "List saved notes, newest first. Optionally filter by text in the title or body.",
    inputSchema: {
      search: z.string().optional().describe("Text to look for in title or body"),
      limit: z.number().int().min(1).max(50).default(10),
    },
  }, ({ search, limit }) => {
    const q = search?.toLowerCase();
    const rows = notes
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .slice()
      .reverse()
      .slice(0, limit);
    return ok(rows);
  });
}
