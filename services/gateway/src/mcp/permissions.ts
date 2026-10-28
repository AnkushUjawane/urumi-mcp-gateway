import { pool } from "../db.js";

export type Role = "admin" | "member";

export const matches = (pattern: string, name: string) =>
  pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

async function denied(role: Role): Promise<string[]> {
  if (role === "admin") return [];                       // admins are never restricted
  const { rows } = await pool.query("SELECT pattern FROM tool_rules WHERE role = $1", [role]);
  return rows.map((r) => r.pattern);
}

export async function isAllowed(role: Role, name: string): Promise<boolean> {
  return !(await denied(role)).some((p) => matches(p, name));
}

// Hides denied tools from any list shown to this role.
export async function filterTools<T extends { name: string }>(role: Role, tools: T[]): Promise<T[]> {
  const d = await denied(role);
  return d.length ? tools.filter((t) => !d.some((p) => matches(p, t.name))) : tools;
}
