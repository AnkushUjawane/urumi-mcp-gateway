import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { woo, WooError } from "./wooClient.js";

// Trim WooCommerce's ~90-field objects down to what a model needs (saves context window).
const product = (p: any) => ({
  id: p.id, name: p.name, price: p.price, status: p.status,
  stock_status: p.stock_status, url: p.permalink,
});

const order = (o: any) => ({
  id: o.id, status: o.status, total: o.total, currency: o.currency,
  date_created: o.date_created,
  customer: `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim(),
  payment_method: o.payment_method_title,
  items: (o.line_items ?? []).map((i: any) => ({ name: i.name, quantity: i.quantity, total: i.total })),
});

// Success -> normal result. Failure -> isError result with a readable message,
// so the model can read it and recover. (Protocol errors are a different thing.)
async function run(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  } catch (e: any) {
    const msg = e instanceof WooError ? e.message : `Unexpected error: ${e?.message ?? e}`;
    return { isError: true, content: [{ type: "text" as const, text: msg }] };
  }
}

const limit = z.number().int().min(1).max(50).default(10).describe("Max items to return (1-50, default 10)");

export function registerTools(server: McpServer) {
  server.registerTool("list_products", {
    description: "List products in the store. Optionally search by text or filter by status.",
    inputSchema: {
      search: z.string().optional().describe("Text to search in product names"),
      status: z.enum(["publish", "draft", "private", "any"]).optional(),
      limit,
    },
  }, ({ search, status, limit }) => run(async () => {
    const rows: any[] = await woo("GET", "/products", { query: { search, status, per_page: limit } });
    return rows.map(product);
  }));

  server.registerTool("create_product", {
    description: "Create a new simple product. It is published immediately and appears on the storefront.",
    inputSchema: {
      name: z.string().min(1).describe("Product name"),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a plain number like 499 or 19.99").describe("Regular price as a number string"),
      description: z.string().optional(),
    },
  }, ({ name, price, description }) => run(async () => {
    const p = await woo("POST", "/products", {
      body: { name, regular_price: price, description, status: "publish" },
    });
    return product(p);
  }));

  server.registerTool("list_orders", {
    description: "List orders, newest first. Filter by status and/or date range (ISO 8601, e.g. 2026-10-14T00:00:00).",
    inputSchema: {
      status: z.enum(["any", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]).optional(),
      after: z.string().optional().describe("Only orders created after this ISO 8601 date-time"),
      before: z.string().optional().describe("Only orders created before this ISO 8601 date-time"),
      limit,
    },
  }, ({ status, after, before, limit }) => run(async () => {
    const rows: any[] = await woo("GET", "/orders", {
      query: { status, after, before, per_page: limit, orderby: "date", order: "desc" },
    });
    return rows.map(order);
  }));

  server.registerTool("get_order", {
    description: "Get full details of one order by its ID.",
    inputSchema: { id: z.number().int().positive().describe("Order ID") },
  }, ({ id }) => run(async () => order(await woo("GET", `/orders/${id}`))));

  server.registerTool("update_order_status", {
    description: "Change the status of an order.",
    inputSchema: {
      id: z.number().int().positive().describe("Order ID"),
      status: z.enum(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]),
    },
  }, ({ id, status }) => run(async () => order(await woo("PUT", `/orders/${id}`, { body: { status } }))));
}
