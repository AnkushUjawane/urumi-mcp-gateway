import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});
const fail = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });

// A tiny calculator: numbers, + - * / % ^, parentheses, unary minus. Nothing else.
// There is deliberately NO eval(): tool input comes from a model, and a model can be
// manipulated, so it must be treated as untrusted.
function calculate(input: string): number {
  if (input.length > 200) throw new Error("Expression too long (max 200 characters)");
  const tokens = input.match(/\d+\.?\d*|\.\d+|[()+\-*/%^]|\s+/g) ?? [];
  if (tokens.join("") !== input) throw new Error("Only numbers, + - * / % ^ and parentheses are allowed");
  const t = tokens.filter((x) => x.trim() !== "");
  let i = 0;

  const peek = () => t[i];
  const next = () => t[i++];

  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term();
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const r = unary();
      if ((op === "/" || op === "%") && r === 0) throw new Error("Division by zero");
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  function unary(): number {
    if (peek() === "-") { next(); return -unary(); }
    return power();
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") { next(); return Math.pow(base, unary()); }
    return base;
  }
  function primary(): number {
    const tok = next();
    if (tok === undefined) throw new Error("Unexpected end of expression");
    if (tok === "(") {
      const v = expr();
      if (next() !== ")") throw new Error("Missing closing parenthesis");
      return v;
    }
    const n = Number(tok);
    if (Number.isNaN(n)) throw new Error(`Unexpected token: ${tok}`);
    return n;
  }

  const result = expr();
  if (i < t.length) throw new Error(`Unexpected token: ${t[i]}`);
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number");
  return result;
}

export function registerTools(server: McpServer) {
  server.registerTool("ping", {
    description: "Health check for the utils server. Returns 'pong' with the server name and time.",
    inputSchema: {},
  }, () => ok({ reply: "pong", server: "utils-mcp", time: new Date().toISOString() }));

  server.registerTool("current_time", {
    description: "Get the current date and time, optionally in an IANA timezone such as Asia/Kolkata.",
    inputSchema: { timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Kolkata. Default UTC.") },
  }, ({ timezone }) => {
    const tz = timezone ?? "UTC";
    try {
      const now = new Date();
      return ok({
        timezone: tz,
        local: new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, dateStyle: "full", timeStyle: "long",
        }).format(now),
        iso_utc: now.toISOString(),
      });
    } catch {
      return fail(`Unknown timezone: ${tz}`);
    }
  });

  server.registerTool("calculate", {
    description: "Evaluate an arithmetic expression using + - * / % ^ and parentheses, e.g. '2 * (3 + 4)'.",
    inputSchema: { expression: z.string().min(1).describe("Arithmetic expression") },
  }, ({ expression }) => {
    try { return ok({ expression, result: calculate(expression) }); }
    catch (e: any) { return fail(e.message); }
  });
}
