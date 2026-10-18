import { z } from "zod";

// All configuration comes from environment variables (Kubernetes Secrets/ConfigMaps).
// If anything is missing or weak, we refuse to start and say exactly why.
const schema = z.object({
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32, "must be at least 32 characters"),
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  UPSTREAM_LIST_TIMEOUT_MS: z.coerce.number().int().default(3000),
  UPSTREAM_CALL_TIMEOUT_MS: z.coerce.number().int().default(15000),
  SEED_WOO_URL: z.string().url().optional(),
  REFRESH_INTERVAL_MS: z.coerce.number().int().default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid configuration:");
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
export const config = parsed.data;
