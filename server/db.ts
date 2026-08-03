// Reference: javascript_database blueprint
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";

/**
 * Picks the Postgres driver to match the host.
 *
 * @neondatabase/serverless talks to Neon over a WebSocket. That is correct for
 * Neon (and for Replit, whose Postgres is Neon underneath) but it cannot speak
 * to an ordinary Postgres server at all — against localhost or Supabase every
 * query fails with an opaque WebSocket ErrorEvent rather than a connection
 * error, which is why the server booted with an unexplained ECONNREFUSED and
 * registration returned a bare 500.
 *
 * Neon hosts keep the serverless driver. Everything else uses node-postgres, so
 * local development and non-Neon hosts work without a code change.
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const isNeon = /\.neon\.tech(?::|\/|$|\?)/.test(connectionString);

async function createDb() {
  if (isNeon) {
    const [{ Pool, neonConfig }, { drizzle }, ws] = await Promise.all([
      import("@neondatabase/serverless"),
      import("drizzle-orm/neon-serverless"),
      import("ws"),
    ]);
    neonConfig.webSocketConstructor = ws.default;
    const pool = new Pool({ connectionString });
    return { pool, db: drizzle({ client: pool, schema }) };
  }

  const [{ default: pg }, { drizzle }] = await Promise.all([
    import("pg"),
    import("drizzle-orm/node-postgres"),
  ]);
  // Managed Postgres (Supabase, RDS) refuses unencrypted connections;
  // localhost generally has no certificate to verify.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  return { pool, db: drizzle(pool, { schema }) };
}

const created = await createDb();

console.log(`[db] using ${isNeon ? "neon-serverless" : "node-postgres"} driver`);

export const pool = created.pool as any;

// Both drivers expose the same query surface for everything this app uses.
// Declaring the Neon type keeps inference intact for every caller — widening
// this to `any` silently strips typing across the whole codebase.
export const db = created.db as unknown as NeonDatabase<typeof schema>;
